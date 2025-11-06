const userService = require('../services/userService');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

async function refreshToken(req, res) {
    const logger = require('../utils/logger');
    try {
        const provided = req.body.refreshToken || req.headers['x-refresh-token'];
        if (!provided) return res.status(400).json({ error: 'refreshToken missing' });
        const result = await userService.refreshTokens(provided);
        // return new pair and user profile
        const { user, accessToken, refreshToken } = result;
        user._id = String(user.id || user._id);
        try {
            res.cookie('refreshToken', refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 7 * 24 * 60 * 60 * 1000
            });
        } catch (e) {
            logger.debug('[UserController] No se pudo establecer cookie refreshToken:', e.message || e);
        }
        return res.status(200).json({ user, accessToken });
    } catch (err) {
        logger.warn('[UserController] Error refreshing token:', err && err.message ? err.message : err);
        return res.status(401).json({ error: 'Refresh token inválido o expirado' });
    }
}

async function logout(req, res) {
    const logger = require('../utils/logger');
    try {
        // Accept refreshToken in body or use authenticated user
        const provided = req.body.refreshToken || req.headers['x-refresh-token'];
        if (provided) {
            // verify to get id
            try {
                const decoded = jwt.verify(provided, process.env.JWT_SECRET);
                await userService.revokeRefreshTokenForUser(decoded.id);
                // clear cookie if present
                try { res.clearCookie('refreshToken'); } catch (e) {}
                return res.status(200).json({ message: 'Logged out' });
            } catch (err) {
                return res.status(400).json({ error: 'refreshToken inválido' });
            }
        }
        // fallback: if user is authenticated, revoke by id
        if (req.userId) {
            await userService.revokeRefreshTokenForUser(req.userId);
            try { res.clearCookie('refreshToken'); } catch (e) {}
            return res.status(200).json({ message: 'Logged out' });
        }
        return res.status(400).json({ error: 'No se proporcionó refreshToken ni usuario autenticado' });
    } catch (err) {
        logger.error('[UserController] Error en logout:', err && err.message ? err.message : err);
        return res.status(500).json({ error: 'Fallo al cerrar sesión' });
    }
}

async function login(req, res) {
    const logger = require('../utils/logger');
    logger.info('[UserController] Recibida petición de login');
    const { usernameOrEmail, password } = req.body;
    
    try {
    logger.debug(`[UserController] Intentando login para: ${usernameOrEmail}`);
        const result = await userService.login(usernameOrEmail, password);
        const { user, accessToken, refreshToken } = result;
        logger.debug('[UserController] Login exitoso y tokens generados');
        // Aseguramos que el cliente reciba _id además de id
        const userForClient = Object.assign({}, user);
        userForClient._id = String(userForClient.id || userForClient._id);
        // Set refresh token as HttpOnly cookie for extra security (frontend should prefer this)
        try {
            res.cookie('refreshToken', refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
            });
        } catch (e) {
            logger.debug('[UserController] No se pudo establecer cookie refreshToken:', e.message || e);
        }
        return res.status(200).json({ user: userForClient, accessToken });
    } catch (error) {
        logger.warn("[UserController] Error al iniciar sesión:", error.message);
        return res.status(401).json({ error: 'Credenciales inválidas.' });
    }
}

async function getMe(req, res) {
    try {
    logger.info('[UserController] Petición GET /me recibida');
        // Si el middleware ya adjuntó `req.user`, lo usamos para evitar una consulta adicional
        if (!req.user && !req.userId) {
            logger.warn('[UserController] No se encontró user en req (token faltante o middleware no aplicado)');
            return res.status(401).json({ error: 'No autorizado' });
        }

        // Para asegurar consistencia devolvemos siempre el perfil completo
        // obtenido desde la base de datos (mismo formato que login/createUser)
        const userId = req.userId || (req.user && req.user.id);
        const userObj = await userService.getProfileById(userId);
        userObj._id = String(userObj.id || userObj._id);
        const response = userObj;

        const logUserId = req.user ? req.user.id : req.userId;
        logger.debug(`[UserController] Devolviendo perfil para usuario ID: ${logUserId}`);
        return res.status(200).json(response);
    } catch (error) {
        logger.error('[UserController] Error en getMe:', error.message || error);
        return res.status(500).json({ error: 'Fallo al recuperar el perfil del usuario.' });
    }
}

async function createUser(req, res) {
    const logger = require('../utils/logger');
    logger.info('[UserController] Recibida petición de creación de usuario');
    try {
        const userData = req.body;
        logger.debug("[UserController] Datos recibidos para crear usuario:", {
            username: userData.username,
            email: userData.email,
            // Omitimos password por seguridad en los logs
        });

    logger.debug('[UserController] Iniciando creación de usuario en el servicio');
    const result = await userService.createUser(userData);
        
    logger.debug('[UserController] Usuario creado exitosamente y tokens generados');
        const { user, accessToken, refreshToken } = result;
        const userForClient = Object.assign({}, user);
        userForClient._id = String(userForClient.id || userForClient._id);
        try {
            res.cookie('refreshToken', refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
            });
        } catch (e) {
            logger.debug('[UserController] No se pudo establecer cookie refreshToken:', e.message || e);
        }
        return res.status(201).json({
            message: 'Usuario creado exitosamente',
            user: userForClient,
            accessToken
        });
    } catch (error) {
        logger.error("[UserController] Error al crear usuario:", error.message);
        // Si el error es una violación de unicidad (email ya existe), devolvemos 400 Bad Request
        if (error.message.includes('email ya está registrado')) {
             return res.status(400).json({ error: error.message });
        }
        return res.status(500).json({ error: 'Fallo interno del servidor.' });
    }
}

module.exports = {
    login,
    createUser,
    getMe,
    refreshToken,
    logout,
};
