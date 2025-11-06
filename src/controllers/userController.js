const userService = require('../services/userService');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

async function login(req, res) {
    const logger = require('../utils/logger');
    logger.info('[UserController] Recibida petición de login');
    const { usernameOrEmail, password } = req.body;
    
    try {
    logger.debug(`[UserController] Intentando login para: ${usernameOrEmail}`);
        const user = await userService.login(usernameOrEmail, password);
        
        logger.debug(`[UserController] Login exitoso, generando token para usuario ID: ${user.id}`);
        const token = jwt.sign({ id: user.id, username: user.username, email: user.email, admin: user.admin }, process.env.JWT_SECRET, { expiresIn: '1h' });
        
    logger.debug('[UserController] Token generado exitosamente');
    // Aseguramos que el cliente reciba _id además de id
    const userForClient = Object.assign({}, user);
    userForClient._id = String(userForClient.id || userForClient._id);
    return res.status(200).json({ user: userForClient, token });
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
    const newUser = await userService.createUser(userData);
        
    logger.debug(`[UserController] Usuario creado exitosamente con ID: ${newUser.id}, generando token`);
    const token = jwt.sign({ id: newUser.id, username: newUser.username, email: newUser.email, admin: newUser.admin }, process.env.JWT_SECRET, { expiresIn: '1h' });
        
    logger.debug('[UserController] Token generado exitosamente para el nuevo usuario');
        const userForClient = Object.assign({}, newUser);
        userForClient._id = String(userForClient.id || userForClient._id);
        return res.status(201).json({
            message: 'Usuario creado exitosamente',
            user: userForClient,
            token
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
};
