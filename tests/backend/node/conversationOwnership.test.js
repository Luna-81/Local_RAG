const assert = require('node:assert/strict');
const { test } = require('node:test');
const Module = require('node:module');
const path = require('node:path');

const backendRequire = Module.createRequire(path.join(__dirname, '../../../backend/package.json'));
const Database = backendRequire('better-sqlite3');
const testDb = new Database(':memory:');
testDb.exec(`
  CREATE TABLE conversations (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    messages TEXT NOT NULL,
    updated_at TEXT,
    is_pinned INTEGER DEFAULT 0,
    kb_id INTEGER
  );
`);

const originalLoad = Module._load;
let ConversationModel;
let chatRouter;

Module._load = function (request, parent, isMain) {
  if (request === '../config/db' && parent?.filename.endsWith('/models/ConversationModel.js')) {
    return { db: testDb };
  }
  return originalLoad.apply(this, arguments);
};

try {
  ConversationModel = backendRequire('./models/ConversationModel');
} finally {
  Module._load = originalLoad;
}

Module._load = function (request, parent, isMain) {
  if (
    request === '../models/ConversationModel' &&
    parent?.filename.endsWith('/router/chatRouter.js')
  ) {
    return ConversationModel;
  }
  if (
    request === '../middleware/authMiddleware' &&
    parent?.filename.endsWith('/router/chatRouter.js')
  ) {
    return { authenticate: (req, res, next) => next() };
  }
  if (request === '../models/QAStatsModel' && parent?.filename.endsWith('/router/chatRouter.js')) {
    return { record() {} };
  }
  return originalLoad.apply(this, arguments);
};

try {
  chatRouter = backendRequire('./router/chatRouter');
} finally {
  Module._load = originalLoad;
}

const sendHandler = chatRouter.stack.find((layer) => layer.route?.path === '/send').route.stack[0]
  .handle;

test('a user cannot overwrite another user conversation using its ID', (t) => {
  t.after(() => testDb.close());

  const conversationId = 'conversation-owned-by-a';
  const originalMessages = [{ role: 'user', content: 'A private message' }];
  ConversationModel.save(conversationId, 1, 'User A conversation', originalMessages, 1);
  const ownerUpdateMessages = [{ role: 'user', content: 'A second private message' }];
  const ownerUpdate = ConversationModel.save(
    conversationId,
    1,
    'User A updated conversation',
    ownerUpdateMessages,
    1,
  );
  assert.equal(ownerUpdate.changes, 1);

  let responseStatus = 200;
  let responseBody;
  sendHandler(
    {
      user: { id: 2 },
      body: {
        conversationId,
        title: 'Overwritten by B',
        messages: [{ role: 'user', content: 'B attempted to overwrite this conversation' }],
      },
    },
    {
      status(code) {
        responseStatus = code;
        return this;
      },
      json(body) {
        responseBody = body;
        return this;
      },
    },
  );

  assert.equal(responseStatus, 404);
  assert.deepEqual(responseBody, {
    success: false,
    message: 'Conversation not found or unauthorized.',
  });
  const unchangedConversation = ConversationModel.findById(conversationId);
  assert.equal(unchangedConversation.user_id, 1);
  assert.equal(unchangedConversation.title, 'User A updated conversation');
  assert.deepEqual(unchangedConversation.messages, ownerUpdateMessages);
  assert.equal(unchangedConversation.kb_id, 1);
});
