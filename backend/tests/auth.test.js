const { test } = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');
process.env.JWT_SECRET = 'test-only-secret-that-is-at-least-32-bytes';
const jwt = require('jsonwebtoken');
let user = { id: 1, username: 'admin', user_type: 3, token_version: 0 };
const original = Module._load;
Module._load = function(name) {
    if (name === '../models/UserModel') return { findById: () => user };
    return original.apply(this, arguments);
};
const { authenticate, authorize } = require('../middleware/authMiddleware');
Module._load = original;
function token(payload = {}, options = {}) {
    return jwt.sign({ id: 1, token_version: 0, ...payload }, process.env.JWT_SECRET,
        { algorithm: 'HS256', issuer: 'local-rag', audience: 'local-rag-api', expiresIn: '1h', ...options });
}
function request(header, role) {
    const req = { headers: { authorization: header } };
    const result = { status: 200, passed: false };
    const res = { status(code) { result.status = code; return this; }, json() {} };
    authenticate(req, res, () => {
        if (role) authorize([role])(req, res, () => { result.passed = true; });
        else result.passed = true;
    });
    return result;
}
test('signed sessions require strict Bearer headers and valid claims', () => {
    assert.equal(request(`Bearer ${token()}`).passed, true);
    for (const header of [undefined, `Other ${token()}`, 'Bearer invalid', `Bearer ${token({}, { expiresIn: -1 })}`, `Bearer ${token({}, { audience: 'wrong' })}`, `Bearer ${token({}, { algorithm: 'HS384' })}`, `Bearer ${token({ id: '1' })}`]) {
        assert.equal(request(header).status, 401);
    }
});
test('current database role controls authorization; deleted and revoked users fail', () => {
    const signed = token();
    user = { ...user, user_type: 1 };
    assert.equal(request(`Bearer ${signed}`, 3).status, 403);
    user = { ...user, token_version: 1 };
    assert.equal(request(`Bearer ${signed}`).status, 401);
    user = null;
    assert.equal(request(`Bearer ${signed}`).status, 401);
});
