/**
 * Cookie utilities for handling refresh tokens
 */

/**
 * Get standard cookie options for refresh tokens
 * @returns {Object} Cookie configuration object
 */
function getCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true' ? true : (process.env.NODE_ENV === 'production'),
    sameSite: (process.env.COOKIE_SAMESITE || (process.env.NODE_ENV === 'production' ? 'none' : 'lax')).toLowerCase(),
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  };
}

/**
 * Set refresh token cookie
 * @param {Response} res - Express response object
 * @param {string} refreshToken - The refresh token to set
 * @returns {boolean} True if successful, false otherwise
 */
function setRefreshTokenCookie(res, refreshToken) {
  try {
    res.cookie('refreshToken', refreshToken, getCookieOptions());
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Clear refresh token cookie
 * @param {Response} res - Express response object
 * @returns {boolean} True if successful, false otherwise
 */
function clearRefreshTokenCookie(res) {
  try {
    res.clearCookie('refreshToken');
    return true;
  } catch (e) {
    return false;
  }
}

module.exports = {
  getCookieOptions,
  setRefreshTokenCookie,
  clearRefreshTokenCookie
};
