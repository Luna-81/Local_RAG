// backend/utils/reqUser.js
/**
 * Extract the current user's id from the request.
 *
 * The `authenticate` middleware must run first and populate req.user
 * with the JWT payload: { id, username, user_type }.
 *
 * Returns null if called on an unauthenticated request.
 */
function getUserId(req) {
    return (req && req.user && req.user.id) || null;
}

module.exports = { getUserId };
