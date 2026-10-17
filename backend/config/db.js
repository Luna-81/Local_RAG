// backend/config/db.js
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const { SQLITE_PATH } = require('./runtime');

// Ensure the configured database parent directory exists.
fs.mkdirSync(path.dirname(SQLITE_PATH), { recursive: true });

// Initialize SQLite3 database
const db = new Database(SQLITE_PATH);
db.pragma('journal_mode = WAL');

function createUsersTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        user_type INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    `);
}

function createConversationsTable() {
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
}

function migrateConversationColumns() {
  const columns = new Set(
    db
      .prepare('PRAGMA table_info(conversations)')
      .all()
      .map((column) => column.name),
  );

  if (!columns.has('is_pinned')) {
    db.exec(`ALTER TABLE conversations ADD COLUMN is_pinned INTEGER DEFAULT 0;`);
  }

  if (!columns.has('kb_id')) {
    db.exec(`ALTER TABLE conversations ADD COLUMN kb_id INTEGER;`);
  }
  db.exec(`CREATE INDEX IF NOT EXISTS idx_conv_kb ON conversations(kb_id);`);
}

function createFileListTable() {
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
}

function markInterruptedUploadsFailed() {
  // Upload workers are children of this server and cannot survive its restart.
  db.prepare("UPDATE filelist SET status = 'failed' WHERE status = 'processing'").run();
}

function createQaStatsTable() {
  db.exec(`
        CREATE TABLE IF NOT EXISTS qa_stats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            question TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
    `);
}

function migrateUserSchema() {
  const columns = db.prepare('PRAGMA table_info(users)').all();
  if (!columns.some((column) => column.name === 'token_version')) {
    db.exec('ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0');
  }
}

function migratePlaintextPasswords() {
  // Migrate existing plaintext passwords once, invalidating previous sessions.
  db.transaction(() => {
    for (const user of db.prepare('SELECT id, password FROM users').all()) {
      if (!/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(user.password)) {
        db.prepare(
          'UPDATE users SET password = ?, token_version = token_version + 1 WHERE id = ?',
        ).run(bcrypt.hashSync(user.password, 12), user.id);
      }
    }
  })();
}

function seedDefaultAdmin() {
  const adminCheck = db.prepare('SELECT * FROM users WHERE username = ?').get('admin');
  if (!adminCheck) {
    const initialPassword = process.env.INITIAL_ADMIN_PASSWORD;
    if (
      !initialPassword ||
      initialPassword.length < 12 ||
      Buffer.byteLength(initialPassword) > 72
    ) {
      throw new Error(
        'Set INITIAL_ADMIN_PASSWORD (12–72 bytes, at least 12 characters) for first startup.',
      );
    }
    db.prepare('INSERT INTO users (username, password, user_type) VALUES (?, ?, ?)').run(
      'admin',
      bcrypt.hashSync(initialPassword, 12),
      3,
    );
  }
}

function createAuditTables() {
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
}

function createXdpTables() {
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
}

function createKnowledgeBaseTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_bases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        description TEXT DEFAULT '',
        table_name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    `);
}

function createKnowledgeBaseIndexes() {
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_filelist_hash ON filelist(content_hash);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_filelist_kb ON filelist(kb_id);`);
}

function seedDefaultKnowledgeBase() {
  const kbCount = db.prepare('SELECT COUNT(*) AS c FROM knowledge_bases').get().c;
  if (kbCount === 0) {
    db.prepare('INSERT INTO knowledge_bases (name, description, table_name) VALUES (?, ?, ?)').run(
      'default',
      'Default knowledge base',
      'kb_1',
    );
    console.log('Created initial KB: default (table=kb_1)');
  }
}

function initDatabase() {
  createUsersTable();
  createConversationsTable();
  migrateConversationColumns();
  createFileListTable();
  markInterruptedUploadsFailed();
  createQaStatsTable();
  migrateUserSchema();
  migratePlaintextPasswords();
  seedDefaultAdmin();
  createAuditTables();
  createXdpTables();
  createKnowledgeBaseTable();
  createKnowledgeBaseIndexes();
  seedDefaultKnowledgeBase();

  console.log('SQLite3 database initialized successfully.');
}

module.exports = { db, initDatabase };
