const userService = require('../services/userService');
const autoMessageService = require('../services/autoMessageService');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const { setRefreshTokenCookie, clearRefreshTokenCookie } = require('../utils/cookieUtils');
const ERROR_MESSAGES = require('../utils/errorMessages');

async function refreshToken(req, res) {
    try {
        const provided = req.body.refreshToken || req.headers['x-refresh-token'] || (req.cookies && req.cookies.refreshToken);
        if (!provided) return res.status(400).json({ error: ERROR_MESSAGES.AUTH.REFRESH_TOKEN_MISSING });
        
        const result = await userService.refreshTokens(provided);
        const { user, accessToken, refreshToken } = result;
        user._id = String(user.id || user._id);
        
        setRefreshTokenCookie(res, refreshToken);
        
        return res.status(200).json({ user, accessToken });
    } catch (err) {
        return res.status(401).json({ error: ERROR_MESSAGES.AUTH.REFRESH_TOKEN_INVALID });
    }
}

async function logout(req, res) {
    try {
        // Accept refreshToken in body or use authenticated user
    const provided = req.body.refreshToken || req.headers['x-refresh-token'] || (req.cookies && req.cookies.refreshToken);
        if (provided) {
            // verify to get id
            try {
                const decoded = jwt.verify(provided, process.env.JWT_SECRET || 'development_lag_token');
                await userService.revokeRefreshTokenForUser(decoded.id);
                clearRefreshTokenCookie(res);
                return res.status(200).json({ message: 'Logged out' });
            } catch (err) {
                return res.status(400).json({ error: ERROR_MESSAGES.AUTH.REFRESH_TOKEN_INVALID });
            }
        }
        // fallback: if user is authenticated, revoke by id
        if (req.userId) {
            await userService.revokeRefreshTokenForUser(req.userId);
            clearRefreshTokenCookie(res);
            return res.status(200).json({ message: 'Logged out' });
        }
        return res.status(400).json({ error: ERROR_MESSAGES.AUTH.LOGOUT_NO_TOKEN });
    } catch (err) {
        logger.error('[UserController] Error en logout:', err && err.message ? err.message : err);
        return res.status(500).json({ error: ERROR_MESSAGES.GENERIC.LOGOUT_FAILED });
    }
}

async function login(req, res) {
    const { usernameOrEmail, password } = req.body;
    
    try {
        const result = await userService.login(usernameOrEmail, password);
        const { user, accessToken, refreshToken } = result;
        
        const userForClient = Object.assign({}, user);
        userForClient._id = String(userForClient.id || userForClient._id);
        
        setRefreshTokenCookie(res, refreshToken);
        
        return res.status(200).json({ user: userForClient, accessToken });
    } catch (error) {
        return res.status(401).json({ error: ERROR_MESSAGES.AUTH.INVALID_CREDENTIALS });
    }
}

async function getMe(req, res) {
    try {
        if (!req.user && !req.userId) {
            return res.status(401).json({ error: ERROR_MESSAGES.AUTH.UNAUTHORIZED });
        }

        const userId = req.userId || (req.user && req.user.id);
        const userObj = await userService.getProfileById(userId);
        userObj._id = String(userObj.id || userObj._id);
        const response = userObj;

        return res.status(200).json(response);
    } catch (error) {
        logger.error('[UserController] Error en getMe:', error.message || error);
        return res.status(500).json({ error: ERROR_MESSAGES.USER.PROFILE_FETCH_FAILED });
    }
}

async function createUser(req, res) {
    try {
        const userData = req.body;

        const result = await userService.createUser(userData);
        let { user, accessToken, refreshToken } = result;
        
        // Send welcome message to new user
        try {
            await autoMessageService.sendWelcomeMessage(user.id);
        } catch (err) {
            // No fallar el registro si falla el mensaje
        }
        
        // Si por alguna razón el servicio de creación no devolvió tokens, intentamos login inmediato
        if (!accessToken || !refreshToken) {
            try {
                const loginResult = await userService.login(userData.username, userData.password);
                accessToken = loginResult.accessToken;
                refreshToken = loginResult.refreshToken;
                user = loginResult.user || user;
            } catch (e) {
                // Ignore token generation failure
            }
        }
        
        const userForClient = Object.assign({}, user);
        userForClient._id = String(userForClient.id || userForClient._id);
        
        setRefreshTokenCookie(res, refreshToken);
        
        return res.status(201).json({
            message: 'Usuario creado exitosamente',
            user: userForClient,
            accessToken
        });
    } catch (error) {
        logger.error("[UserController] Error al crear usuario:", error.message);
        
        if (error && error.name === 'SequelizeUniqueConstraintError') {
            const fields = (error.errors || []).map(e => e.path).filter(Boolean);
            const uniqueFields = fields.length ? fields.join(', ') : 'username/email';
            return res.status(409).json({ error: `Registro duplicado: ${uniqueFields} ya existe(n).` });
        }
        
        if (error.message && error.message.includes('usuario/email ya está registrado')) {
            return res.status(409).json({ error: error.message });
        }
        
        return res.status(500).json({ error: ERROR_MESSAGES.GENERIC.INTERNAL_ERROR_ES });
    }
}

module.exports = {
    login,
    createUser,
    getMe,
    refreshToken,
    logout,
};
