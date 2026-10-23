const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { test } = require('node:test');
const Module = require('node:module');
const path = require('node:path');

const backendRequire = Module.createRequire(path.join(__dirname, '../../../backend/package.json'));
const originalLoad = Module._load;
let spawnCalls = [];
let qaRouter;

class FakeChildProcess extends EventEmitter {
  constructor() {
    super();
    this.stdout = new EventEmitter();
    this.stderr = new EventEmitter();
    this.stdin = {
      written: '',
      ended: false,
      write: (chunk) => {
        this.stdin.written += chunk;
      },
      end: () => {
        this.stdin.ended = true;
      },
    };
  }

  kill() {
    this.killed = true;
  }
}

Module._load = function (request, parent, isMain) {
  if (
    request === '../models/KnowledgeBaseModel' &&
    parent?.filename.endsWith('/router/qaRouter.js')
  ) {
    return {
      findById: (id) => (id === 1 ? { name: 'Test KB', tableName: 'test_kb' } : null),
    };
  }
  if (
    request === '../middleware/authMiddleware' &&
    parent?.filename.endsWith('/router/qaRouter.js')
  ) {
    return { authenticate: (req, res, next) => next() };
  }
  if (request === '../services/pythonProcess' && parent?.filename.endsWith('/router/qaRouter.js')) {
    return {
      spawnParser: (...args) => {
        const child = new FakeChildProcess();
        spawnCalls.push({ args, child });
        return child;
      },
    };
  }
  return originalLoad.apply(this, arguments);
};

try {
  qaRouter = backendRequire('./router/qaRouter');
} finally {
  Module._load = originalLoad;
}

const askHandler = qaRouter.stack.find((layer) => layer.route?.path === '/ask').route.stack[1]
  .handle;

function invokeAsk(body) {
  const response = {
    statusCode: 200,
    headersSent: false,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      this.headersSent = true;
      return this;
    },
  };
  askHandler({ body }, response);
  return response;
}

test('QA route rejects invalid questions and knowledge-base IDs before starting Python', () => {
  spawnCalls = [];

  assert.equal(invokeAsk({ question: '   ', kbId: 1 }).statusCode, 400);
  assert.equal(invokeAsk({ question: 'valid question', kbId: 'bad' }).statusCode, 400);
  assert.equal(invokeAsk({ question: 'valid question', kbId: 99 }).statusCode, 404);
  assert.equal(spawnCalls.length, 0);
});

test('QA route forwards the selected KB and returns parsed answer and sources', () => {
  spawnCalls = [];
  const response = invokeAsk({ question: 'What is in the document?', kbId: 1 });
  const {
    args: [script, args, options],
    child,
  } = spawnCalls[0];

  assert.equal(script, 'ask.py');
  assert.deepEqual(args, ['What is in the document?']);
  assert.equal(options.env.KB_TABLE, 'test_kb');
  assert.equal(child.stdin.written, 'What is in the document?\n');
  assert.equal(child.stdin.ended, true);

  child.stdout.emit(
    'data',
    Buffer.from(
      JSON.stringify({
        success: true,
        answer: 'The document describes the system.',
        sources: [{ document_name: 'guide.pdf', page: 2 }],
      }),
    ),
  );
  child.emit('close', 0);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    success: true,
    answer: 'The document describes the system.',
    sources: [{ document_name: 'guide.pdf', page: 2 }],
  });
});

test('QA route reports parser process and malformed JSON failures', () => {
  spawnCalls = [];
  const processFailure = invokeAsk({ question: 'question', kbId: 1 });
  const failedChild = spawnCalls[0].child;
  failedChild.stderr.emit('data', Buffer.from('parser crashed'));
  failedChild.emit('close', 1);
  assert.equal(processFailure.statusCode, 500);
  assert.equal(processFailure.body.message, 'AI inference failed');

  spawnCalls = [];
  const invalidJson = invokeAsk({ question: 'question', kbId: 1 });
  const invalidChild = spawnCalls[0].child;
  invalidChild.stdout.emit('data', Buffer.from('not JSON'));
  invalidChild.emit('close', 0);
  assert.equal(invalidJson.statusCode, 500);
  assert.equal(invalidJson.body.message, 'No valid JSON response from AI');
});
