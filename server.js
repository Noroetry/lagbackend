
const app = require('./src/app'); 
const db = require('./src/config/database');
const logger = require('./src/utils/logger');

const PORT = process.env.PORT || 3000; 

const startServer = async () => {
  try {
    await db.sequelize.authenticate();
    logger.info('Conexión a la base de datos PostgreSQL establecida exitosamente.');

    await db.sequelize.sync({ alter: true }); 
    logger.info('Tablas sincronizadas (Modelos cargados).');

    app.listen(PORT, () => {
      logger.info(`Servidor Express - Server running (port ${PORT})`);
    });

  } catch (error) {
    logger.error('Error al iniciar el servidor o la base de datos:', error && error.message ? error.message : error);
    process.exit(1); 
  }
};

startServer();