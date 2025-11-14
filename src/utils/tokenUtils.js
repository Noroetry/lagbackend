/**
 * JWT Token utilities
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

/**
 * Generate access token (short-lived)
 * @param {Object} payload - Token payload containing user data
 * @returns {string} Signed JWT access token
 */
function generateAccessToken(payload) {
  const secret = process.env.JWT_SECRET || 'development_lag_token';
  return jwt.sign(payload, secret, { expiresIn: '1h' });
}

/**
 * Generate refresh token (long-lived)
 * @param {Object} payload - Token payload containing user data
 * @returns {string} Signed JWT refresh token with unique jti
 */
function generateRefreshToken(payload) {
  const secret = process.env.JWT_SECRET || 'development_lag_token';
  // Add a random jti/nonce to ensure the token string is unique on each generation
  const payloadWithJti = Object.assign({}, payload, { 
    jti: crypto.randomBytes(16).toString('hex') 
  });
  return jwt.sign(payloadWithJti, secret, { 
    expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d' 
  });
}

/**
 * Verify and decode a token
 * @param {string} token - Token to verify
 * @returns {Object} Decoded token payload
 * @throws {Error} If token is invalid or expired
 */
function verifyToken(token) {
  const secret = process.env.JWT_SECRET || 'development_lag_token';
  return jwt.verify(token, secret);
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyToken
};
