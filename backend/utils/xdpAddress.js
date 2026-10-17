function ipToHexArray(ipAddress) {
  if (typeof ipAddress !== 'string') return null;
  const octets = ipAddress.trim().split('.');
  if (octets.length !== 4 || octets.some((octet) => !/^\d{1,3}$/.test(octet))) return null;

  const values = octets.map(Number);
  if (values.some((value) => value < 0 || value > 255)) return null;
  return values.map((value) => `0x${value.toString(16).padStart(2, '0')}`);
}

function hexArrayToIp(hexArray) {
  if (!Array.isArray(hexArray) || hexArray.length !== 4) return null;
  const octets = hexArray.map((value) => {
    if (Number.isInteger(value)) return value;
    if (typeof value !== 'string' || !/^(?:0x)?[0-9a-f]{1,2}$/i.test(value)) return NaN;
    return Number.parseInt(value.replace(/^0x/i, ''), 16);
  });
  if (octets.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) {
    return null;
  }
  return octets.join('.');
}

module.exports = { ipToHexArray, hexArrayToIp };
