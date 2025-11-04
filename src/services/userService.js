const db = require('../config/database');
const { Op } = require('sequelize');
const User = db.User;
const Message = db.Message;

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

    return userWithoutPassword;
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

        return userWithoutPassword;
    } catch (error) {
        logger.error("[UserService] Error al crear usuario:", error);
        if (error.name === 'SequelizeUniqueConstraintError') {
            console.log(`[UserService] Error de duplicación: ${userData.username} o ${userData.email} ya existe`);
            throw new Error(`El usuario/email ya está registrado. Por favor, utiliza otro.`);
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

module.exports = {
    login,
    createUser,
    getAllUsers,
    getUserById,
};