const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET; 

const protect = (req, res, next) => {
    console.log('[AuthMiddleware] Verificando autorización para ruta:', req.originalUrl);
    let token;

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        try {
            console.log('[AuthMiddleware] Token Bearer encontrado, verificando...');
            token = req.headers.authorization.split(' ')[1];

            const decoded = jwt.verify(token, JWT_SECRET);
            console.log(`[AuthMiddleware] Token válido para usuario ID: ${decoded.id}`);

            // Adjuntamos el usuario decodificado para que los controladores tengan acceso
            req.userId = decoded.id;
            req.user = {
                id: decoded.id,
                username: decoded.username,
                email: decoded.email,
                admin: decoded.admin
            };

            console.log('[AuthMiddleware] Autorización exitosa, continuando con la petición');
            next();
        } catch (error) {
            console.error('[AuthMiddleware] Error de verificación de token:', {
                error: error.message,
                token: token ? token.substring(0, 10) + '...' : 'null'
            });
            return res.status(401).json({ message: 'No autorizado, token fallido o expirado' });
        }
    }

    if (!token) {
        console.log('[AuthMiddleware] No se encontró token en la petición');
        return res.status(401).json({ message: 'No autorizado, no hay token' });
    }
};

module.exports = { protect };