const db = require('../config/database');
const { Op } = require('sequelize');
const User = db.User;
const Message = db.Message;
const UsersLevel = db.UsersLevel;
const autoMessageService = require('./autoMessageService');

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
        
        if (!user.refreshToken || user.refreshToken !== providedRefreshToken) {
            throw new Error('Refresh token inválido');
        }
        
        const payload = { id: user.id, username: user.username, email: user.email, admin: user.admin };
        const newAccessToken = generateAccessToken(payload);
        const newRefreshToken = generateRefreshToken(payload);
        await user.update({ refreshToken: newRefreshToken });
        
        try { await user.reload(); } catch (e) { /* ignore reload failures */ }
        const userObj = user.toJSON ? user.toJSON() : user;
        delete userObj.password;
        return { user: userObj, accessToken: newAccessToken, refreshToken: newRefreshToken };
    } catch (err) {
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
    
    const user = await User.findOne({ where: { [Op.or]: [{ username: usernameOrEmail }, { email: usernameOrEmail }] } });

    if (!user) {
        throw new Error('Credenciales inválidas.');
    }

    const isMatch = await user.comparePassword(password); 

    if (!isMatch) {
        throw new Error('Credenciales inválidas.');
    }
    
    logger.info(`Usuario ${user.username} inicia sesión`);
    
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
        userWithoutPassword.messages = [];
    }

    // generate token pair and persist refresh token on user record
    try {
        const payload = { id: user.id, username: user.username, email: user.email, admin: user.admin };
        const accessToken = generateAccessToken(payload);
        const refreshToken = generateRefreshToken(payload);
        await user.update({ refreshToken });
        userWithoutPassword._refreshToken = refreshToken;
        return { user: userWithoutPassword, accessToken, refreshToken };
    } catch (err) {
        return { user: userWithoutPassword };
    }
}

async function createUser(userData) {
    const logger = require('../utils/logger');
    
    if (!userData.email || !userData.username || !userData.password) {
        throw new Error("Nombre de usuario, email y contraseña son obligatorios.");
    }
    
    const reserved = ['admin', 'root', 'system'];
    const usernameLower = (userData.username || '').toString().toLowerCase();
    if (reserved.some(r => usernameLower.includes(r))) {
        throw new Error('El nombre de usuario contiene palabras reservadas y no está permitido.');
    }
    
    try {
        const newUser = await User.create(userData);
        
        logger.info(`Usuario ${newUser.username} se registra`);
        
        const userWithoutPassword = newUser.toJSON();
        delete userWithoutPassword.password;

        userWithoutPassword.messages = [];

        // Crear un mensaje de bienvenida
        try {
            if (Message) {
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
            }
        } catch (err) {
            // Silently fail welcome message
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
            return { user: userWithoutPassword };
        }
    } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') {
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
        userObj.messages = [];
    }

    // Determine user's current level_number by comparing totalExp with users_levels.minExpRequired
    try {
        if (UsersLevel) {
            const totalExp = Number(userObj.totalExp || 0);
            const levelRow = await UsersLevel.findOne({
                where: { minExpRequired: { [Op.lte]: totalExp } },
                order: [['minExpRequired', 'DESC']]
            });
            const levelNumber = levelRow ? (levelRow.levelNumber || levelRow.get('levelNumber') || levelRow.get('level_number')) : 1;
            const minExpRequired = levelRow ? Number(levelRow.minExpRequired) : 0;

            let nextRequired = null;
            try {
                const nextLevelRow = await UsersLevel.findOne({ where: { levelNumber: Number(levelNumber) + 1 } });
                if (nextLevelRow) nextRequired = Number(nextLevelRow.minExpRequired);
            } catch (e) {
                // ignore errors fetching next level
            }

            userObj.level_number = Number(levelNumber) || 1;
            userObj.totalExp = Number(userObj.totalExp || 0);
            userObj.minExpRequired = minExpRequired;
            userObj.nextRequiredLevel = nextRequired;
        } else {
            userObj.level_number = Number(userObj.level || 1);
            userObj.totalExp = Number(userObj.totalExp || 0);
            userObj.minExpRequired = 0;
            userObj.nextRequiredLevel = null;
        }
    } catch (err) {
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