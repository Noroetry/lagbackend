const express = require('express');
const app = express();
const cookieParser = require('cookie-parser');
const cors = require('cors');
const userRoutes = require('./routes/userRoutes');
const questRoutes = require('./routes/questRoutes');

// Configure CORS to allow credentials (cookies) from frontend origin
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || null;
const corsOptions = {
  origin: FRONTEND_ORIGIN || true, // if FRONTEND_ORIGIN set, use it; otherwise reflect request origin
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.get('/', (req, res) => {
  res.send('API Node.js con Express, Sequelize y PostgreSQL funcionando.');
});

app.use('/api/users', userRoutes);
app.use('/api/quests', questRoutes);

app.use((req, res, next) => {
  res.status(404).json({ message: 'Ruta no encontrada' });
});

module.exports = app;