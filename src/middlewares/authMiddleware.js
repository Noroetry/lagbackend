const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const { User } = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET;

const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, JWT_SECRET);
            
            logger.info(`Token de usuario ${decoded.username} accede al servidor`);

            // Verificar que el usuario aún existe en la base de datos
            const user = await User.findByPk(decoded.id);
            if (!user) {
                logger.warn(`Token inválido - usuario ${decoded.username} no existe`);
                return res.status(401).json({ message: 'No autorizado, usuario no encontrado' });
            }

            // Adjuntamos el usuario decodificado para que los controladores tengan acceso
            req.userId = decoded.id;
            req.user = {
                id: decoded.id,
                username: decoded.username,
                email: decoded.email,
                admin: decoded.admin
            };

            return next();
        } catch (error) {
            return res.status(401).json({ message: 'No autorizado, token fallido o expirado' });
        }
    }

    return res.status(401).json({ message: 'No autorizado, no hay token' });
};

module.exports = { protect };