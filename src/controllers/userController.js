const userService = require('../services/userService');
const jwt = require('jsonwebtoken');

async function login(req, res) {
    console.log('[UserController] Recibida petición de login');
    const { usernameOrEmail, password } = req.body;
    
    try {
        console.log(`[UserController] Intentando login para: ${usernameOrEmail}`);
        const user = await userService.login(usernameOrEmail, password);
        
        console.log(`[UserController] Login exitoso, generando token para usuario ID: ${user.id}`);
        const token = jwt.sign({ id: user.id, username: user.username, email: user.email, admin: user.admin }, process.env.JWT_SECRET, { expiresIn: '1h' });
        
        console.log('[UserController] Token generado exitosamente');
        return res.status(200).json({ user, token });
    } catch (error) {
        console.error("[UserController] Error al iniciar sesión:", error.message);
        return res.status(401).json({ error: 'Credenciales inválidas.' });
    }
}

async function getAllUsers(req, res) {
    try {
        const users = await userService.getAllUsers();
        return res.status(200).json(users);
    } catch (error) {
        console.error("Error al obtener usuarios:", error);
        return res.status(500).json({ error: 'Fallo al recuperar los datos de usuario.' });
    }
}

async function getUserById(req, res) {
    const userId = req.params.id;
    try {
        const user = await userService.getUserById(userId);
        return res.status(200).json(user);
    } catch (error) {
        console.error("Error al obtener el usuario:", error);
        return res.status(500).json({ error: 'Fallo al recuperar los datos del usuario.' });
    }
}

async function createUser(req, res) {
    console.log('[UserController] Recibida petición de creación de usuario');
    try {
        const userData = req.body;
        console.log("[UserController] Datos recibidos para crear usuario:", {
            username: userData.username,
            email: userData.email,
            // Omitimos password por seguridad en los logs
        });

        console.log('[UserController] Iniciando creación de usuario en el servicio');
        const newUser = await userService.createUser(userData);
        
        console.log(`[UserController] Usuario creado exitosamente con ID: ${newUser.id}, generando token`);
        const token = jwt.sign({ id: newUser.id, username: newUser.username, email: newUser.email, admin: newUser.admin }, process.env.JWT_SECRET, { expiresIn: '1h' });
        
        console.log('[UserController] Token generado exitosamente para el nuevo usuario');
        return res.status(201).json({
            message: 'Usuario creado exitosamente',
            user: newUser,
            token
        });
    } catch (error) {
        console.error("[UserController] Error al crear usuario:", error.message);
        // Si el error es una violación de unicidad (email ya existe), devolvemos 400 Bad Request
        if (error.message.includes('email ya está registrado')) {
             return res.status(400).json({ error: error.message });
        }
        return res.status(500).json({ error: 'Fallo interno del servidor.' });
    }
}

module.exports = {
    login,
    getAllUsers,
    getUserById,
    createUser,
};
