// Keep the access token only for the lifetime of the current page.
let accessToken = null;

export const getAccessToken = () => accessToken;
export const setAccessToken = (token) => { accessToken = token; };
export const clearAccessToken = () => { accessToken = null; };

// Discard credentials stored by older versions of the app.
localStorage.removeItem('token');
localStorage.removeItem('user');
