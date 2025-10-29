const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET; 

const protect = (req, res, next) => {
    let token;

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        try {
            token = req.headers.authorization.split(' ')[1];

            const decoded = jwt.verify(token, JWT_SECRET);

            req.userId = decoded.id; 
            
            next();
        } catch (error) {
            console.error('Error de verificación de token:', error);
            return res.status(401).json({ message: 'No autorizado, token fallido o expirado' });
        }
    }

    if (!token) {
        return res.status(401).json({ message: 'No autorizado, no hay token' });
    }
};

module.exports = { protect };