const express = require('express');
const router = express.Router();
const { exec } = require('child_process');
const path = require('path');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const { USER_TYPES } = require('../config/constants');
const { db } = require('../config/db');

const HELPER = path.join(__dirname, '..', '..', 'xdp-helper.sh');

function runHelper(args, cb) {
    exec(`bash "${HELPER}" ${args}`, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
        if (error) return cb(error, null, stderr);
        cb(null, stdout, null);
    });
}

// ─── IP ↔ hex 数组 ──────────────────────────────────

// 写白名单用：'1.2.3.4' → ['0x01','0x02','0x03','0x04']
function ipToHexArray(ipStr) {
    if (!ipStr || typeof ipStr !== 'string') return null;
    const parts = ipStr.trim().split('.').map(Number);
    if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) return null;
    return parts.map(b => '0x' + b.toString(16).padStart(2, '0'));
}

// 读 map 用：['0x8c','0x52','0x70','0x15'] → '140.82.112.21'
// 注意：bpftool dump 出来的 key 数组顺序与 IP 一致，不要反转
function hexArrayToIp(hexArray) {
    if (!Array.isArray(hexArray) || hexArray.length !== 4) return null;
    return hexArray.map(h => parseInt(h, 16)).join('.');
}

// ─── sqlite 白名单操作 ──────────────────────────────
function getDbWhitelist() {
    try {
        return db.prepare('SELECT ip FROM xdp_whitelist ORDER BY ip').all().map(r => r.ip);
    } catch (e) {
        console.error('[XDP] getDbWhitelist error:', e.message);
        return [];
    }
}

function addToDb(ip, userId) {
    try {
        db.prepare('INSERT OR IGNORE INTO xdp_whitelist (ip, added_by) VALUES (?, ?)').run(ip, userId || null);
    } catch (e) {
        console.error('[XDP] addToDb error:', e.message);
    }
}

function removeFromDb(ip) {
    try {
        db.prepare('DELETE FROM xdp_whitelist WHERE ip = ?').run(ip);
    } catch (e) {
        console.error('[XDP] removeFromDb error:', e.message);
    }
}

// 把 sqlite 白名单同步到 BPF map（幂等）
function syncWhitelistToBpf(callback) {
    const ips = getDbWhitelist();
    if (ips.length === 0) return callback();

    let pending = ips.length;
    let firstError = null;
    ips.forEach(ip => {
        const hex = ipToHexArray(ip);
        if (!hex) {
            pending--;
            if (pending === 0) callback(firstError);
            return;
        }
        runHelper(`add-whitelist ${hex.join(' ')}`, (err) => {
            if (err && !firstError) firstError = err;
            pending--;
            if (pending === 0) callback(firstError);
        });
    });
}

// ─── per-IP 拒绝历史的增量同步 ───────────────────────
// BPF map 里是"本次会话"累计，sqlite 里保存跨会话 total_count
// 每次同步：delta = current - last_session_count，然后把 last_session_count 更新为 current
// 若 current < last_session_count（reload 过），则 delta = current
function syncDropToDb(bpfList) {
    try {
        const upsert = db.prepare(`
            INSERT INTO xdp_drop_history (ip, total_count, last_session_count)
            VALUES (?, ?, ?)
            ON CONFLICT(ip) DO UPDATE SET
                total_count = total_count + excluded.total_count,
                last_session_count = excluded.last_session_count,
                last_seen = CURRENT_TIMESTAMP
        `);
        const getRow = db.prepare('SELECT last_session_count FROM xdp_drop_history WHERE ip = ?');

        const tx = db.transaction((list) => {
            for (const { ip, count: current } of list) {
                const row = getRow.get(ip);
                let delta;
                if (!row) {
                    delta = current;
                } else if (current >= row.last_session_count) {
                    delta = current - row.last_session_count;
                } else {
                    delta = current;
                }
                if (delta > 0) {
                    upsert.run(ip, delta, current);
                } else if (row) {
                    db.prepare('UPDATE xdp_drop_history SET last_session_count = ?, last_seen = CURRENT_TIMESTAMP WHERE ip = ?')
                      .run(current, ip);
                }
            }
        });
        tx(bpfList);
    } catch (e) {
        console.error('[XDP] syncDropToDb error:', e.message);
    }
}

// 从 BPF 读一次 drop_by_ip 并同步到 sqlite
function refreshDropFromBpf(callback) {
    runHelper('dump-drop-by-ip', (err, stdout) => {
        if (err) return callback && callback(err, []);
        try {
            const raw = JSON.parse(stdout);
            const list = [];
            if (Array.isArray(raw)) {
                raw.forEach(item => {
                    const ip = hexArrayToIp(item.key);
                    const count = Number(item?.formatted?.value ?? 0) || 0;
                    if (ip && count > 0) list.push({ ip, count });
                });
            }
            syncDropToDb(list);
            if (callback) callback(null, list);
        } catch (e) {
            console.error('[XDP] refreshDropFromBpf parse error:', e.message);
            if (callback) callback(e, []);
        }
    });
}

// ─── 路由：统计 ─────────────────────────────────────

// GET /api/xdp/stats
router.get('/stats', authenticate, authorize([USER_TYPES.SYS_ADMIN]), (req, res) => {
    runHelper('dump-stats', (err, stdout, stderr) => {
        if (err) {
            console.error('[XDP Error] stats:', stderr || err.message);
            return res.status(500).json({ success: false, message: 'XDP not running or map missing.' });
        }
        try {
            const data = JSON.parse(stdout);
            const f = data[0]?.formatted?.value || {};
            const passedTotal  = Number(f.passed_total)  || 0;
            const droppedTotal = Number(f.dropped_total) || 0;
            const tcpDropped   = Number(f.tcp_dropped)   || 0;
            const udpDropped   = Number(f.udp_dropped)   || 0;
            const icmpDropped  = Number(f.icmp_dropped)  || 0;
            const otherDropped = Number(f.other_dropped) || 0;
            const total = passedTotal + droppedTotal;
            res.json({
                success: true,
                stats: {
                    passedTotal,
                    droppedTotal,
                    totalPackets: total,
                    dropRate: total > 0 ? (droppedTotal / total) * 100 : 0,
                    tcpDropped,
                    udpDropped,
                    icmpDropped,
                    otherDropped,
                }
            });
        } catch (e) {
            res.status(500).json({ success: false, message: 'Parse error: ' + e.message });
        }
    });
});

// ─── 路由：白名单 ───────────────────────────────────

// GET /api/xdp/whitelist —— 先从 sqlite 同步到 BPF，再返回
router.get('/whitelist', authenticate, authorize([USER_TYPES.SYS_ADMIN]), (req, res) => {
    syncWhitelistToBpf(() => {
        res.json({ success: true, whitelist: getDbWhitelist() });
    });
});

// POST /api/xdp/whitelist —— 同时写 BPF map 和 sqlite
router.post('/whitelist', authenticate, authorize([USER_TYPES.SYS_ADMIN]), (req, res) => {
    const { ip } = req.body;
    if (!ip) return res.status(400).json({ success: false, message: 'ip required.' });
    const hex = ipToHexArray(ip);
    if (!hex) return res.status(400).json({ success: false, message: 'Invalid IPv4.' });

    runHelper(`add-whitelist ${hex.join(' ')}`, (err, stdout, stderr) => {
        if (err) return res.status(500).json({ success: false, message: stderr || err.message });
        addToDb(ip, req.user?.id);
        console.log(`[XDP] ${req.user?.username} added ${ip} to whitelist`);
        res.json({ success: true, message: `Added ${ip}`, ip });
    });
});

// DELETE /api/xdp/whitelist —— 同时删 BPF map 和 sqlite
router.delete('/whitelist', authenticate, authorize([USER_TYPES.SYS_ADMIN]), (req, res) => {
    const { ip } = req.body;
    if (!ip) return res.status(400).json({ success: false, message: 'ip required.' });
    const hex = ipToHexArray(ip);
    if (!hex) return res.status(400).json({ success: false, message: 'Invalid IPv4.' });

    runHelper(`del-whitelist ${hex.join(' ')}`, (err, stdout, stderr) => {
        if (err) return res.status(500).json({ success: false, message: stderr || err.message });
        removeFromDb(ip);
        console.log(`[XDP] ${req.user?.username} removed ${ip} from whitelist`);
        res.json({ success: true, message: `Removed ${ip}`, ip });
    });
});

// ─── 路由：被拒 IP ──────────────────────────────────

// GET /api/xdp/drop-by-ip —— 本次会话被拒 IP（实时）
router.get('/drop-by-ip', authenticate, authorize([USER_TYPES.SYS_ADMIN]), (req, res) => {
    refreshDropFromBpf((err, list) => {
        if (err) return res.status(500).json({ success: false, message: err.message || 'XDP not running' });
        list.sort((a, b) => b.count - a.count);
        res.json({ success: true, list });
    });
});

// GET /api/xdp/drop-history —— 历史累计被拒 IP（持久）
router.get('/drop-history', authenticate, authorize([USER_TYPES.SYS_ADMIN]), (req, res) => {
    try {
        const rows = db.prepare(`
            SELECT ip, total_count, first_seen, last_seen
            FROM xdp_drop_history
            ORDER BY total_count DESC
            LIMIT 200
        `).all();
        res.json({ success: true, list: rows });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// DELETE /api/xdp/drop-history —— 清空历史
router.delete('/drop-history', authenticate, authorize([USER_TYPES.SYS_ADMIN]), (req, res) => {
    try {
        db.prepare('DELETE FROM xdp_drop_history').run();
        res.json({ success: true, message: 'History cleared' });
    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// ─── 后台定时同步（每 5 秒） ─────────────────────────
// 不依赖前端是否打开，被拒 IP 会自动持久化
setInterval(() => {
    refreshDropFromBpf(() => {});
}, 5000);

// ─── 后端启动时延迟 3 秒自动从 sqlite 同步白名单到 BPF map ───
setTimeout(() => {
    console.log('[XDP] startup: syncing whitelist from sqlite to BPF map...');
    syncWhitelistToBpf((err) => {
        if (err) {
            console.error('[XDP] startup whitelist sync failed:', err.message);
        } else {
            console.log('[XDP] startup whitelist sync completed');
        }
    });
}, 3000);

module.exports = router;