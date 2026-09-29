// backend/server.js
const express = require('express');
const cors = require('cors');

const { initDatabase } = require('./config/db');

const authRouter = require('./router/authRouter');
const documentRouter = require('./router/documentRouter');
const kbRouter = require('./router/kbRouter');                      
const chatRouter = require('./router/chatRouter');
const qaRouter = require('./router/qaRouter');
const lancedbRouter = require('./router/lancedbRouter');
const adminRouter = require('./router/adminRouter');
const { auditLogger } = require('./middleware/auditMiddleware');
const xdpRouter = require('./router/xdpRouter');


const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(auditLogger);

initDatabase();

app.use('/api/auth', authRouter);
app.post('/api/login', (req, res, next) => { req.url = '/login'; authRouter(req, res, next); });

app.use('/api/documents', documentRouter);
app.post('/api/upload', (req, res, next) => { req.url = '/upload'; documentRouter(req, res, next); });

app.use('/api/kb', kbRouter);                                       

app.use('/api/chat', chatRouter);
app.use('/api/conversations', chatRouter);

app.use('/api/qa', qaRouter);
app.post('/api/ask', (req, res, next) => { req.url = '/ask'; qaRouter(req, res, next); });

app.use('/api/lancedb', lancedbRouter);
app.use('/api/admin', adminRouter);
app.use('/api/knowledge', require('./router/knowledgeRouter'));

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.use('/api/xdp', xdpRouter);

app.listen(PORT, () => {
    console.log('========================================');
    console.log(`Server running: http://localhost:${PORT}`);
    console.log('Database connected & architecture modularized');
    console.log('========================================');
});