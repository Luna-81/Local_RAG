// Keep the token for the current browser tab, including page refreshes.
const tokenKey = 'accessToken';

export const getAccessToken = () => sessionStorage.getItem(tokenKey);
export const setAccessToken = (token) => {
  sessionStorage.setItem(tokenKey, token);
};
export const clearAccessToken = () => {
  sessionStorage.removeItem(tokenKey);
};

// Discard credentials stored by older versions of the app.
localStorage.removeItem('token');
localStorage.removeItem('user');
