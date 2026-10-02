// backend/config/db.js
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize SQLite3 database
const db = new Database(path.join(dataDir, 'app.sqlite3'));
db.pragma('journal_mode = WAL');

function initDatabase() {
    // 1. Users table
    db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        user_type INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    `);

    // 2. Conversations table
    db.exec(`
        CREATE TABLE IF NOT EXISTS conversations (
            id TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            messages TEXT NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
    `);

    try {
        db.exec(`ALTER TABLE conversations ADD COLUMN is_pinned INTEGER DEFAULT 0;`);
    } catch (e) {}

    try {
        db.exec(`ALTER TABLE conversations ADD COLUMN kb_id INTEGER;`);
        db.exec(`CREATE INDEX IF NOT EXISTS idx_conv_kb ON conversations(kb_id);`);
    } catch (e) {}

    // 3. File metadata table (with multi-KB fields)
    db.exec(`
        CREATE TABLE IF NOT EXISTS filelist (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT UNIQUE NOT NULL,
            original_name TEXT NOT NULL,
            file_size INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            status TEXT DEFAULT 'completed',
            kb_id INTEGER,
            content_hash TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
    `);

    // 4. QA statistics table
    db.exec(`
        CREATE TABLE IF NOT EXISTS qa_stats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            question TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
    `);

    // Seed default admin
    const adminCheck = db.prepare('SELECT * FROM users WHERE username = ?').get('admin');
    if (!adminCheck) {
        db.prepare('INSERT INTO users (username, password, user_type) VALUES (?, ?, ?)')
          .run('admin', 'admin123', 3);
    }

    console.log('SQLite3 database initialized successfully.');

    // 5. Audit log
    db.exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        username TEXT,
        method TEXT NOT NULL,
        path TEXT NOT NULL,
        status INTEGER,
        ip TEXT,
        duration_ms INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);`);

    // 6. XDP whitelist (persistent, restored after restart)
    db.exec(`
    CREATE TABLE IF NOT EXISTS xdp_whitelist (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ip TEXT UNIQUE NOT NULL,
        added_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_xdp_whitelist_ip ON xdp_whitelist(ip);`);

    // 7. XDP drop history (persistent per-IP counters)
    db.exec(`
    CREATE TABLE IF NOT EXISTS xdp_drop_history (
        ip TEXT PRIMARY KEY,
        total_count INTEGER DEFAULT 0,
        last_session_count INTEGER DEFAULT 0,
        first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    `);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_xdp_drop_count ON xdp_drop_history(total_count DESC);`);

    // ==========================================================
    // 8. Multi-KB support
    // ==========================================================

    // 8.1 Knowledge bases table
    db.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_bases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        description TEXT DEFAULT '',
        table_name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    `);

    // 8.2 Indexes
    //   - content_hash unique globally: same file cannot exist in any KB twice
    //   - kb_id used for listing files by KB
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_filelist_hash ON filelist(content_hash);`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_filelist_kb ON filelist(kb_id);`);

    // 8.3 First run: create the initial KB for UI
    const kbCount = db.prepare('SELECT COUNT(*) AS c FROM knowledge_bases').get().c;
    if (kbCount === 0) {
        db.prepare(
            'INSERT INTO knowledge_bases (name, description, table_name) VALUES (?, ?, ?)'
        ).run('default', 'Default knowledge base', 'kb_1');
        console.log('Created initial KB: default (table=kb_1)');
    }
}

module.exports = { db, initDatabase };