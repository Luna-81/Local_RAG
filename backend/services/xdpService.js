const { execFile } = require('child_process');
const path = require('path');
const { db } = require('../config/db');
const { hexArrayToIp, ipToHexArray } = require('../utils/xdpAddress');
const { calculateDropDelta, parseStats } = require('../utils/xdpMetrics');

const HELPER = path.join(__dirname, '..', '..', 'xdp-helper.sh');

function runHelper(command, args, callback) {
  execFile(
    'bash',
    [HELPER, command, ...args],
    { maxBuffer: 10 * 1024 * 1024 },
    (error, stdout, stderr) => {
      if (error) return callback(error, null, stderr);
      callback(null, stdout, null);
    },
  );
}

function getDbWhitelist() {
  try {
    return db
      .prepare('SELECT ip FROM xdp_whitelist ORDER BY ip')
      .all()
      .map((row) => row.ip);
  } catch (error) {
    console.error('[XDP] getDbWhitelist error:', error.message);
    return [];
  }
}

function addToDb(ip, userId) {
  try {
    db.prepare('INSERT OR IGNORE INTO xdp_whitelist (ip, added_by) VALUES (?, ?)').run(
      ip,
      userId || null,
    );
  } catch (error) {
    console.error('[XDP] addToDb error:', error.message);
  }
}

function removeFromDb(ip) {
  try {
    db.prepare('DELETE FROM xdp_whitelist WHERE ip = ?').run(ip);
  } catch (error) {
    console.error('[XDP] removeFromDb error:', error.message);
  }
}

function syncWhitelistToBpf(callback) {
  const addresses = getDbWhitelist();
  if (addresses.length === 0) return callback();

  let pending = addresses.length;
  let firstError = null;
  addresses.forEach((ip) => {
    const bytes = ipToHexArray(ip);
    if (!bytes) {
      pending -= 1;
      if (pending === 0) callback(firstError);
      return;
    }
    runHelper('add-whitelist', bytes, (error) => {
      if (error && !firstError) firstError = error;
      pending -= 1;
      if (pending === 0) callback(firstError);
    });
  });
}

function updateDropCount(upsert, getPrevious, updatePrevious, { ip, count }) {
  const previous = getPrevious.get(ip);
  const previousCount = previous ? previous.last_session_count : null;
  const delta = calculateDropDelta(count, previousCount);
  if (delta > 0) {
    upsert.run(ip, delta, count);
  } else if (previous) {
    updatePrevious.run(count, ip);
  }
}

function syncDropToDb(dropCounts) {
  try {
    const upsert = db.prepare(`
      INSERT INTO xdp_drop_history (ip, total_count, last_session_count)
      VALUES (?, ?, ?)
      ON CONFLICT(ip) DO UPDATE SET
        total_count = total_count + excluded.total_count,
        last_session_count = excluded.last_session_count,
        last_seen = CURRENT_TIMESTAMP
    `);
    const getPrevious = db.prepare('SELECT last_session_count FROM xdp_drop_history WHERE ip = ?');
    const updatePrevious = db.prepare(
      'UPDATE xdp_drop_history SET last_session_count = ?, last_seen = CURRENT_TIMESTAMP WHERE ip = ?',
    );
    const updateCounts = db.transaction((rows) => {
      rows.forEach((row) => updateDropCount(upsert, getPrevious, updatePrevious, row));
    });
    updateCounts(dropCounts);
  } catch (error) {
    console.error('[XDP] syncDropToDb error:', error.message);
  }
}

function parseDropMap(stdout) {
  const raw = JSON.parse(stdout);
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => ({
      ip: hexArrayToIp(item.key),
      count: Number(item?.formatted?.value ?? 0) || 0,
    }))
    .filter((item) => item.ip && item.count > 0);
}

function refreshDropFromBpf(callback) {
  runHelper('dump-drop-by-ip', [], (error, stdout) => {
    if (error) return callback?.(error, []);
    try {
      const dropCounts = parseDropMap(stdout);
      syncDropToDb(dropCounts);
      callback?.(null, dropCounts);
    } catch (parseError) {
      console.error('[XDP] refreshDropFromBpf parse error:', parseError.message);
      callback?.(parseError, []);
    }
  });
}

function getDropHistory() {
  return db
    .prepare(
      `SELECT ip, total_count, first_seen, last_seen
       FROM xdp_drop_history
       ORDER BY total_count DESC
       LIMIT 200`,
    )
    .all();
}

function clearDropHistory() {
  return db.prepare('DELETE FROM xdp_drop_history').run().changes;
}

function startBackgroundSync() {
  setInterval(() => refreshDropFromBpf(() => {}), 5000);
  setTimeout(() => {
    console.log('[XDP] startup: syncing whitelist from sqlite to BPF map...');
    syncWhitelistToBpf((error) => {
      if (error) console.error('[XDP] startup whitelist sync failed:', error.message);
      else console.log('[XDP] startup whitelist sync completed');
    });
  }, 3000);
}

module.exports = {
  addToDb,
  clearDropHistory,
  getDbWhitelist,
  getDropHistory,
  hexArrayToIp,
  ipToHexArray,
  parseStats,
  refreshDropFromBpf,
  removeFromDb,
  runHelper,
  startBackgroundSync,
  syncWhitelistToBpf,
};
