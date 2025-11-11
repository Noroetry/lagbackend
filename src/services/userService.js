const db = require('../config/database');
const { Op } = require('sequelize');
const User = db.User;
const Message = db.Message;
const UsersLevel = db.UsersLevel;

const jwt = require('jsonwebtoken');

function generateAccessToken(payload) {
    const secret = process.env.JWT_SECRET || 'development_lag_token';
    return jwt.sign(payload, secret, { expiresIn: '1h' });
}

function generateRefreshToken(payload) {
    // longer lived refresh token
    // Add a random jti/nonce to ensure the token string is unique on each generation
    const crypto = require('crypto');
    const secret = process.env.JWT_SECRET || 'development_lag_token';
    const payloadWithJti = Object.assign({}, payload, { jti: crypto.randomBytes(16).toString('hex') });
    return jwt.sign(payloadWithJti, secret, { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d' });
}

// Rotate refresh token: verify provided refresh token, ensure it matches stored one,
// then generate a new pair and persist the new refresh token.
async function refreshTokens(providedRefreshToken) {
    const logger = require('../utils/logger');
    try {
        const decoded = jwt.verify(providedRefreshToken, process.env.JWT_SECRET);
        const user = await User.findByPk(decoded.id);
        if (!user) throw new Error('Usuario no encontrado');
        // Single active refresh token policy: compare stored value
        if (!user.refreshToken || user.refreshToken !== providedRefreshToken) {
            logger.warn('[UserService] Refresh token no coincide con el almacenado');
            throw new Error('Refresh token inválido');
        }
        const payload = { id: user.id, username: user.username, email: user.email, admin: user.admin };
    const newAccessToken = generateAccessToken(payload);
    const newRefreshToken = generateRefreshToken(payload);
    await user.update({ refreshToken: newRefreshToken });
    // reload to ensure instance reflects persisted value
    try { await user.reload(); } catch (e) { /* ignore reload failures */ }
    const userObj = user.toJSON ? user.toJSON() : user;
    delete userObj.password;
    return { user: userObj, accessToken: newAccessToken, refreshToken: newRefreshToken };
    } catch (err) {
        logger.warn('[UserService] Error en refreshTokens:', err && err.message ? err.message : err);
        throw err;
    }
}

async function revokeRefreshTokenForUser(userId) {
    const user = await User.findByPk(userId);
    if (!user) throw new Error('Usuario no encontrado');
    await user.update({ refreshToken: null });
    return true;
}

async function login(usernameOrEmail, password) {
    const logger = require('../utils/logger');
    logger.debug(`[UserService] Intento de login para usuario/email: ${usernameOrEmail}`);
    
    const user = await User.findOne({ where: { [Op.or]: [{ username: usernameOrEmail }, { email: usernameOrEmail }] } });

    if (!user) {
        logger.warn(`[UserService] Login fallido: Usuario no encontrado para ${usernameOrEmail}`);
        throw new Error('Credenciales inválidas.');
    }

    logger.debug(`[UserService] Usuario encontrado, verificando contraseña para ${usernameOrEmail}`);
    const isMatch = await user.comparePassword(password); 

    if (!isMatch) {
        logger.warn(`[UserService] Login fallido: Contraseña incorrecta para ${usernameOrEmail}`);
        throw new Error('Credenciales inválidas.');
    }
    
    logger.debug(`[UserService] Login exitoso para usuario: ${user.username}`);
    const userWithoutPassword = user.toJSON();
    delete userWithoutPassword.password;

    // Cargar mensajes relacionados (source o destination igual al username)
    try {
        if (Message) {
            const messages = await Message.findAll({
                where: {
                    [Op.or]: [
                        { source: user.username },
                        { destination: user.username }
                    ]
                },
                order: [['dateSent', 'DESC']]
            });
            userWithoutPassword.messages = messages.map(m => (m.toJSON ? m.toJSON() : m));
        } else {
            userWithoutPassword.messages = [];
        }
    } catch (err) {
        logger.error('[UserService] Error cargando mensajes para usuario:', err.message || err);
        userWithoutPassword.messages = [];
    }

    // generate token pair and persist refresh token on user record
    try {
        const payload = { id: user.id, username: user.username, email: user.email, admin: user.admin };
        const accessToken = generateAccessToken(payload);
        const refreshToken = generateRefreshToken(payload);
        // store refresh token server-side to allow rotation/revocation
        await user.update({ refreshToken });
        userWithoutPassword._refreshToken = refreshToken; // internal for controllers if needed
        return { user: userWithoutPassword, accessToken, refreshToken };
    } catch (err) {
        logger.error('[UserService] Error generando tokens en login:', err && err.message ? err.message : err);
        return { user: userWithoutPassword };
    }
}

async function createUser(userData) {
    const logger = require('../utils/logger');
    logger.info(`[UserService] Intento de crear nuevo usuario con username: ${userData.username}, email: ${userData.email}`);
    
    if (!userData.email || !userData.username || !userData.password) {
        logger.warn('[UserService] Error: Datos de usuario incompletos');
        throw new Error("Nombre de usuario, email y contraseña son obligatorios.");
    }
    // Bloquear nombres de usuario que contengan palabras reservadas
    const reserved = ['admin', 'root', 'system'];
    const usernameLower = (userData.username || '').toString().toLowerCase();
    if (reserved.some(r => usernameLower.includes(r))) {
        logger.warn('[UserService] Intento de crear usuario con palabra reservada en el username:', userData.username);
        throw new Error('El nombre de usuario contiene palabras reservadas y no está permitido.');
    }
    
    try {
    logger.debug('[UserService] Creando nuevo usuario en la base de datos...');
    const newUser = await User.create(userData);

    logger.info(`[UserService] Usuario creado exitosamente con ID: ${newUser.id}`);
        const userWithoutPassword = newUser.toJSON();
        delete userWithoutPassword.password;

    // nuevos usuarios empiezan sin mensajes
    userWithoutPassword.messages = [];

        // Crear un mensaje de bienvenida desde el usuario `system` hacia el nuevo usuario.
        // Si la tabla Message existe, añadimos el welcome message y lo adjuntamos a la respuesta.
        try {
            if (Message) {
                // El emisor del mensaje de bienvenida es siempre 'system' (firma del servidor)
                const welcome = await Message.create({
                    title: 'Bienvenido a LifeAsGame',
                    description: `¡Hola ${userWithoutPassword.username}! Bienvenido a LifeAsGame. Gracias por unirte. Explora el juego y diviértete.`,
                    source: 'system',
                    destination: userWithoutPassword.username,
                    adjunts: null,
                    read: 'N',
                    state: 'A'
                });
                userWithoutPassword.messages.push(welcome.toJSON ? welcome.toJSON() : welcome);
                logger.debug('[UserService] Mensaje de bienvenida creado para', userWithoutPassword.username);
            }
        } catch (err) {
            logger.warn('[UserService] No se pudo crear mensaje de bienvenida:', err && err.message);
        }

        // generate tokens and persist refreshToken
        try {
            const payload = { id: newUser.id, username: newUser.username, email: newUser.email, admin: newUser.admin };
            const accessToken = generateAccessToken(payload);
            const refreshToken = generateRefreshToken(payload);
            await newUser.update({ refreshToken });
            userWithoutPassword._refreshToken = refreshToken;
            return { user: userWithoutPassword, accessToken, refreshToken };
        } catch (err) {
            logger.error('[UserService] Error generando tokens en createUser:', err && err.message ? err.message : err);
            return { user: userWithoutPassword };
        }
    } catch (error) {
        logger.error("[UserService] Error al crear usuario:", error);
        if (error.name === 'SequelizeUniqueConstraintError') {
            // rethrow the original Sequelize error so controller can inspect which field conflicted
            logger.warn(`[UserService] Unique constraint violation for username/email: ${userData.username} / ${userData.email}`);
            throw error;
        }
        throw error;
    }
}

async function getAllUsers() {
    const users = await User.findAll({
        attributes: { exclude: ['password'] } 
    });
    return users;
}

async function getUserById(userId) {
    const user = await User.findByPk(userId, {
        attributes: { exclude: ['password'] }
    }); 
    
    if (!user) {
        throw new Error(`Usuario con ID ${userId} no encontrado.`);
    }
    return user;
}

// Devuelve el perfil completo para el cliente: objeto plano (sin password) y con mensajes relacionados
async function getProfileById(userId) {
    const logger = require('../utils/logger');
    const user = await User.findByPk(userId, {
        attributes: { exclude: ['password'] }
    });
    if (!user) {
        throw new Error(`Usuario con ID ${userId} no encontrado.`);
    }
    const userObj = user.toJSON ? user.toJSON() : user;
    // Cargar mensajes relacionados (source o destination igual al username)
    try {
        if (Message) {
            const messages = await Message.findAll({
                where: {
                    [Op.or]: [
                        { source: userObj.username },
                        { destination: userObj.username }
                    ]
                },
                order: [['dateSent', 'DESC']]
            });
            userObj.messages = messages.map(m => (m.toJSON ? m.toJSON() : m));
        } else {
            userObj.messages = [];
        }
    } catch (err) {
        logger.error('[UserService] Error cargando mensajes para perfil:', err.message || err);
        userObj.messages = [];
    }

    // Determine user's current level_number by comparing totalExp with users_levels.minExpRequired
    try {
        if (UsersLevel) {
            const totalExp = Number(userObj.totalExp || 0);
            // find the highest level whose minExpRequired <= totalExp
            const levelRow = await UsersLevel.findOne({
                where: { minExpRequired: { [Op.lte]: totalExp } },
                order: [['minExpRequired', 'DESC']]
            });
            const levelNumber = levelRow ? (levelRow.levelNumber || levelRow.get('levelNumber') || levelRow.get('level_number')) : 1;
            const minExpRequired = levelRow ? Number(levelRow.minExpRequired) : 0;

            // find next level's minExpRequired (or null if at max)
            let nextRequired = null;
            try {
                const nextLevelRow = await UsersLevel.findOne({ where: { levelNumber: Number(levelNumber) + 1 } });
                if (nextLevelRow) nextRequired = Number(nextLevelRow.minExpRequired);
            } catch (e) {
                // ignore errors fetching next level
            }

            // Expose values expected by frontend
            userObj.level_number = Number(levelNumber) || 1;
            userObj.totalExp = Number(userObj.totalExp || 0);
            userObj.minExpRequired = minExpRequired;
            userObj.nextRequiredLevel = nextRequired;
        } else {
            // fallback behavior when UsersLevel table/model not available
            userObj.level_number = Number(userObj.level || 1);
            userObj.totalExp = Number(userObj.totalExp || 0);
            userObj.minExpRequired = 0;
            userObj.nextRequiredLevel = null;
        }
    } catch (err) {
        logger.warn('[UserService] Could not determine level metadata from users_levels:', err && err.message ? err.message : err);
        userObj.level_number = Number(userObj.level || 1);
        userObj.totalExp = Number(userObj.totalExp || 0);
        userObj.minExpRequired = 0;
        userObj.nextRequiredLevel = null;
    }

    return userObj;
}

module.exports = {
    login,
    createUser,
    getAllUsers,
    getUserById,
    getProfileById,
    refreshTokens,
    revokeRefreshTokenForUser,
};