const express = require('express');
const app = express();
const userRoutes = require('./routes/userRoutes'); 

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.send('API Node.js con Express, Sequelize y PostgreSQL funcionando.');
});

app.use('/api/users', userRoutes); 

app.use((req, res, next) => {
  res.status(404).json({ message: 'Ruta no encontrada' });
});

module.exports = app;