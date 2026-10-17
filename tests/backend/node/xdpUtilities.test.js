const test = require('node:test');
const assert = require('node:assert/strict');
const { hexArrayToIp, ipToHexArray } = require('../../../backend/utils/xdpAddress');
const { calculateDropDelta, parseStats } = require('../../../backend/utils/xdpMetrics');

test('IPv4 addresses convert to and from the BPF byte representation', () => {
  const bytes = ipToHexArray('192.168.1.10');

  assert.deepEqual(bytes, ['0xc0', '0xa8', '0x01', '0x0a']);
  assert.equal(hexArrayToIp(bytes), '192.168.1.10');
  assert.equal(hexArrayToIp([192, 168, 1, 10]), '192.168.1.10');
  assert.equal(hexArrayToIp(['c0', 'a8', '01', '0a']), '192.168.1.10');
});

test('IPv4 conversion rejects malformed octets', () => {
  assert.equal(ipToHexArray('192..1.10'), null);
  assert.equal(ipToHexArray('192.168.1.256'), null);
  assert.equal(ipToHexArray('1e2.168.1.10'), null);
  assert.equal(hexArrayToIp(['0xc0', '0xgg', '0x01', '0x0a']), null);
});

test('drop deltas account for new addresses and BPF counter resets', () => {
  assert.equal(calculateDropDelta(14, null), 14);
  assert.equal(calculateDropDelta(14, 9), 5);
  assert.equal(calculateDropDelta(3, 9), 3);
});

test('packet statistics handle missing and populated counters', () => {
  assert.deepEqual(parseStats('[]'), {
    passedTotal: 0,
    droppedTotal: 0,
    totalPackets: 0,
    dropRate: 0,
    tcpDropped: 0,
    udpDropped: 0,
    icmpDropped: 0,
    otherDropped: 0,
  });

  const stats = parseStats(
    JSON.stringify([{ formatted: { value: { passed_total: 80, dropped_total: 20 } } }]),
  );
  assert.equal(stats.totalPackets, 100);
  assert.equal(stats.dropRate, 20);
});
