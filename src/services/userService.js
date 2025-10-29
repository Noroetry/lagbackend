const { User } = require('../config/database');
const { Op } = require('sequelize');

async function login(usernameOrEmail, password) {
    
    const user = await User.findOne({ where: { [Op.or]: [{ username: usernameOrEmail }, { email: usernameOrEmail }] } });

    if (!user) {
        throw new Error('Credenciales inválidas.');
    }

    const isMatch = await user.comparePassword(password); 

    if (!isMatch) {
        throw new Error('Credenciales inválidas.');
    }
    
    const userWithoutPassword = user.toJSON();
    delete userWithoutPassword.password;
    console.log("Usuario autenticado:", userWithoutPassword);
    return userWithoutPassword;
}

async function createUser(userData) {
    if (!userData.email || !userData.username || !userData.password) {
         throw new Error("Nombre de usuario, email y contraseña son obligatorios.");
    }
    
    try {
        const newUser = await User.create(userData);
        
        const userWithoutPassword = newUser.toJSON();
        delete userWithoutPassword.password; // Excluimos la contraseña antes de devolver el usuario
        
        return userWithoutPassword;
    } catch (error) {
        console.log("Error al crear usuario en userService:", error);
        if (error.name === 'SequelizeUniqueConstraintError') {
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