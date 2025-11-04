const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET;

const protect = (req, res, next) => {
    logger.debug('[AuthMiddleware] Verificando autorización para ruta:', req.originalUrl);
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            logger.debug('[AuthMiddleware] Token Bearer encontrado, verificando...');
            token = req.headers.authorization.split(' ')[1];

            const decoded = jwt.verify(token, JWT_SECRET);
            logger.debug('[AuthMiddleware] Token verificado para usuario ID:', decoded.id);

            // Adjuntamos el usuario decodificado para que los controladores tengan acceso
            req.userId = decoded.id;
            req.user = {
                id: decoded.id,
                username: decoded.username,
                email: decoded.email,
                admin: decoded.admin
            };

            logger.debug('[AuthMiddleware] Autorización exitosa, continuando con la petición');
            return next();
        } catch (error) {
            logger.warn('[AuthMiddleware] Error de verificación de token:', error.message);
            return res.status(401).json({ message: 'No autorizado, token fallido o expirado' });
        }
    }

    logger.debug('[AuthMiddleware] No se encontró token en la petición');
    return res.status(401).json({ message: 'No autorizado, no hay token' });
};

module.exports = { protect };