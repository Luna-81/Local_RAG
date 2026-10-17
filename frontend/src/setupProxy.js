const path = require('path');
const dotenv = require('dotenv');
const { createProxyMiddleware } = require('http-proxy-middleware');

dotenv.config({ path: path.resolve(__dirname, '../../backend/.env') });

const apiPort = Number(process.env.API_PORT) || 3000;

module.exports = function configureProxy(app) {
  app.use(
    '/api',
    createProxyMiddleware({ target: `http://127.0.0.1:${apiPort}`, changeOrigin: true }),
  );
  app.use(
    '/health',
    createProxyMiddleware({ target: `http://127.0.0.1:${apiPort}`, changeOrigin: true }),
  );
};
