import api from './indexApi';

/**
 * Obtain the statistics of the kernel traffic flow (Passed / Dropped)
 */
export const fetchXdpStats = async () => {
  const { data } = await api.get('/xdp/stats');
  return data;
};

/**
 * get whilelist 
 */
export const fetchWhitelist = async () => {
  const { data } = await api.get('/xdp/whitelist');
  return data;
};

/**
 * put ip to whilelist
 * @param {string} ip 
 */
export const addWhitelistIp = async (ip) => {
  const { data } = await api.post('/xdp/whitelist', { ip });
  return data;
};

/**
 * delete ip from whilelist
 * @param {string} ip 
 */
export const removeWhitelistIp = async (ip) => {
  // axios.delete 传递 body 需要包装在 data 属性中
  const { data } = await api.delete('/xdp/whitelist', { data: { ip } });
  return data;
};

/**
 * get rejected IPs (current session, from BPF map)
 */
export const fetchDropByIp = async () => {
  const { data } = await api.get('/xdp/drop-by-ip');
  return data;
};

/**
 * get rejected IP history (persistent, from sqlite)
 */
export const fetchDropHistory = async () => {
  const { data } = await api.get('/xdp/drop-history');
  return data;
};

/**
 * clear rejected IP history
 */
export const clearDropHistory = async () => {
  const { data } = await api.delete('/xdp/drop-history');
  return data;
};