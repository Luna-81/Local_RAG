const express = require('express');
const { authenticate, authorize } = require('../middleware/authMiddleware');
const { USER_TYPES } = require('../config/constants');
const {
  addToDb,
  clearDropHistory,
  getDbWhitelist,
  getDropHistory,
  ipToHexArray,
  parseStats,
  refreshDropFromBpf,
  removeFromDb,
  runHelper,
  startBackgroundSync,
  syncWhitelistToBpf,
} = require('../services/xdpService');

const router = express.Router();
const requireAdmin = [authenticate, authorize([USER_TYPES.SYS_ADMIN])];

function respondWithHelperError(res, error, stderr) {
  return res.status(500).json({ success: false, message: stderr || error.message });
}

function validateWhitelistAddress(req, res) {
  const { ip } = req.body;
  if (!ip) {
    res.status(400).json({ success: false, message: 'ip required.' });
    return null;
  }
  const bytes = ipToHexArray(ip);
  if (!bytes) {
    res.status(400).json({ success: false, message: 'Invalid IPv4.' });
    return null;
  }
  return { ip, bytes };
}

router.get('/stats', ...requireAdmin, (req, res) => {
  runHelper('dump-stats', [], (error, stdout, stderr) => {
    if (error) {
      console.error('[XDP Error] stats:', stderr || error.message);
      return res.status(500).json({ success: false, message: 'XDP not running or map missing.' });
    }
    try {
      res.json({ success: true, stats: parseStats(stdout) });
    } catch (parseError) {
      res.status(500).json({ success: false, message: 'Parse error: ' + parseError.message });
    }
  });
});

router.get('/whitelist', ...requireAdmin, (req, res) => {
  syncWhitelistToBpf(() => {
    res.json({ success: true, whitelist: getDbWhitelist() });
  });
});

router.post('/whitelist', ...requireAdmin, (req, res) => {
  const address = validateWhitelistAddress(req, res);
  if (!address) return;

  runHelper('add-whitelist', address.bytes, (error, stdout, stderr) => {
    if (error) return respondWithHelperError(res, error, stderr);
    addToDb(address.ip, req.user?.id);
    console.log(`[XDP] ${req.user?.username} added ${address.ip} to whitelist`);
    res.json({ success: true, message: `Added ${address.ip}`, ip: address.ip });
  });
});

router.delete('/whitelist', ...requireAdmin, (req, res) => {
  const address = validateWhitelistAddress(req, res);
  if (!address) return;

  runHelper('del-whitelist', address.bytes, (error, stdout, stderr) => {
    if (error) return respondWithHelperError(res, error, stderr);
    removeFromDb(address.ip);
    console.log(`[XDP] ${req.user?.username} removed ${address.ip} from whitelist`);
    res.json({ success: true, message: `Removed ${address.ip}`, ip: address.ip });
  });
});

router.get('/drop-by-ip', ...requireAdmin, (req, res) => {
  refreshDropFromBpf((error, list) => {
    if (error) {
      return res.status(500).json({
        success: false,
        message: error.message || 'XDP not running',
      });
    }
    list.sort((left, right) => right.count - left.count);
    res.json({ success: true, list });
  });
});

router.get('/drop-history', ...requireAdmin, (req, res) => {
  try {
    res.json({ success: true, list: getDropHistory() });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/drop-history', ...requireAdmin, (req, res) => {
  try {
    clearDropHistory();
    res.json({ success: true, message: 'History cleared' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

startBackgroundSync();

module.exports = router;
