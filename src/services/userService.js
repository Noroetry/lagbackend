const { User } = require('../config/database');
const { Op } = require('sequelize');

async function login(usernameOrEmail, password) {
    console.log(`[UserService] Intento de login para usuario/email: ${usernameOrEmail}`);
    
    const user = await User.findOne({ where: { [Op.or]: [{ username: usernameOrEmail }, { email: usernameOrEmail }] } });

    if (!user) {
        console.log(`[UserService] Login fallido: Usuario no encontrado para ${usernameOrEmail}`);
        throw new Error('Credenciales inválidas.');
    }

    console.log(`[UserService] Usuario encontrado, verificando contraseña para ${usernameOrEmail}`);
    const isMatch = await user.comparePassword(password); 

    if (!isMatch) {
        console.log(`[UserService] Login fallido: Contraseña incorrecta para ${usernameOrEmail}`);
        throw new Error('Credenciales inválidas.');
    }
    
    console.log(`[UserService] Login exitoso para usuario: ${user.username}`);
    const userWithoutPassword = user.toJSON();
    delete userWithoutPassword.password;
    
    return userWithoutPassword;
}

async function createUser(userData) {
    console.log(`[UserService] Intento de crear nuevo usuario con username: ${userData.username}, email: ${userData.email}`);
    
    if (!userData.email || !userData.username || !userData.password) {
         console.log('[UserService] Error: Datos de usuario incompletos');
         throw new Error("Nombre de usuario, email y contraseña son obligatorios.");
    }
    
    try {
        console.log('[UserService] Creando nuevo usuario en la base de datos...');
        const newUser = await User.create(userData);
        
        console.log(`[UserService] Usuario creado exitosamente con ID: ${newUser.id}`);
        const userWithoutPassword = newUser.toJSON();
        delete userWithoutPassword.password;
        
        return userWithoutPassword;
    } catch (error) {
        console.log("[UserService] Error al crear usuario:", error);
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