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

// IPv4 address and hexadecimal byte conversion helpers.

// Convert an IPv4 address to the bytes expected by bpftool whitelist commands.
function ipToHexArray(ipStr) {
  if (!ipStr || typeof ipStr !== 'string') return null;
  const parts = ipStr.trim().split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) return null;
  return parts.map((b) => '0x' + b.toString(16).padStart(2, '0'));
}

// Convert a bpftool map key to an IPv4 address. Keep the byte order unchanged.
function hexArrayToIp(hexArray) {
  if (!Array.isArray(hexArray) || hexArray.length !== 4) return null;
  return hexArray.map((h) => parseInt(h, 16)).join('.');
}

// SQLite whitelist operations.
function getDbWhitelist() {
  try {
    return db
      .prepare('SELECT ip FROM xdp_whitelist ORDER BY ip')
      .all()
      .map((r) => r.ip);
  } catch (e) {
    console.error('[XDP] getDbWhitelist error:', e.message);
    return [];
  }
}

function addToDb(ip, userId) {
  try {
    db.prepare('INSERT OR IGNORE INTO xdp_whitelist (ip, added_by) VALUES (?, ?)').run(
      ip,
      userId || null,
    );
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

// Synchronize the SQLite whitelist to the BPF map. Repeated calls are safe.
function syncWhitelistToBpf(callback) {
  const ips = getDbWhitelist();
  if (ips.length === 0) return callback();

  let pending = ips.length;
  let firstError = null;
  ips.forEach((ip) => {
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

// Persist per-IP drop-count deltas across XDP reloads.
// The BPF map counts the current session; SQLite stores totals across sessions.
// If a reload resets the BPF count, treat the current count as the new delta.
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
          db.prepare(
            'UPDATE xdp_drop_history SET last_session_count = ?, last_seen = CURRENT_TIMESTAMP WHERE ip = ?',
          ).run(current, ip);
        }
      }
    });
    tx(bpfList);
  } catch (e) {
    console.error('[XDP] syncDropToDb error:', e.message);
  }
}

// Read the BPF drop map and persist the current count deltas.
function refreshDropFromBpf(callback) {
  runHelper('dump-drop-by-ip', (err, stdout) => {
    if (err) return callback && callback(err, []);
    try {
      const raw = JSON.parse(stdout);
      const list = [];
      if (Array.isArray(raw)) {
        raw.forEach((item) => {
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

// Statistics routes.

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
      const passedTotal = Number(f.passed_total) || 0;
      const droppedTotal = Number(f.dropped_total) || 0;
      const tcpDropped = Number(f.tcp_dropped) || 0;
      const udpDropped = Number(f.udp_dropped) || 0;
      const icmpDropped = Number(f.icmp_dropped) || 0;
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
        },
      });
    } catch (e) {
      res.status(500).json({ success: false, message: 'Parse error: ' + e.message });
    }
  });
});

// Whitelist routes.

// GET /api/xdp/whitelist synchronizes SQLite state to BPF before returning it.
router.get('/whitelist', authenticate, authorize([USER_TYPES.SYS_ADMIN]), (req, res) => {
  syncWhitelistToBpf(() => {
    res.json({ success: true, whitelist: getDbWhitelist() });
  });
});

// POST /api/xdp/whitelist updates both the BPF map and SQLite.
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

// DELETE /api/xdp/whitelist removes the address from BPF and SQLite.
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

// Dropped-IP routes.

// GET /api/xdp/drop-by-ip returns rejected IPs from the current session.
router.get('/drop-by-ip', authenticate, authorize([USER_TYPES.SYS_ADMIN]), (req, res) => {
  refreshDropFromBpf((err, list) => {
    if (err)
      return res.status(500).json({ success: false, message: err.message || 'XDP not running' });
    list.sort((a, b) => b.count - a.count);
    res.json({ success: true, list });
  });
});

// GET /api/xdp/drop-history returns rejected-IP totals persisted across sessions.
router.get('/drop-history', authenticate, authorize([USER_TYPES.SYS_ADMIN]), (req, res) => {
  try {
    const rows = db
      .prepare(
        `
            SELECT ip, total_count, first_seen, last_seen
            FROM xdp_drop_history
            ORDER BY total_count DESC
            LIMIT 200
        `,
      )
      .all();
    res.json({ success: true, list: rows });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// DELETE /api/xdp/drop-history clears the persisted history.
router.delete('/drop-history', authenticate, authorize([USER_TYPES.SYS_ADMIN]), (req, res) => {
  try {
    db.prepare('DELETE FROM xdp_drop_history').run();
    res.json({ success: true, message: 'History cleared' });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Persist drop counts every five seconds, independent of frontend activity.
setInterval(() => {
  refreshDropFromBpf(() => {});
}, 5000);

// Synchronize the SQLite whitelist to BPF three seconds after startup.
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
