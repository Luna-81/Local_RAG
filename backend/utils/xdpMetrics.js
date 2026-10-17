function calculateDropDelta(currentCount, previousCount) {
  if (previousCount === null || currentCount < previousCount) return currentCount;
  return currentCount - previousCount;
}

function parseStats(stdout) {
  const data = JSON.parse(stdout);
  const values = data[0]?.formatted?.value || {};
  const passedTotal = Number(values.passed_total) || 0;
  const droppedTotal = Number(values.dropped_total) || 0;
  const totalPackets = passedTotal + droppedTotal;
  return {
    passedTotal,
    droppedTotal,
    totalPackets,
    dropRate: totalPackets > 0 ? (droppedTotal / totalPackets) * 100 : 0,
    tcpDropped: Number(values.tcp_dropped) || 0,
    udpDropped: Number(values.udp_dropped) || 0,
    icmpDropped: Number(values.icmp_dropped) || 0,
    otherDropped: Number(values.other_dropped) || 0,
  };
}

module.exports = { calculateDropDelta, parseStats };
