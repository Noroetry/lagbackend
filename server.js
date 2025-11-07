
const app = require('./src/app'); 
const db = require('./src/config/database');
const logger = require('./src/utils/logger');

const PORT = process.env.PORT || 3000; 

const startServer = async () => {
  try {
    await db.sequelize.authenticate();
    logger.info('Conexión a la base de datos PostgreSQL establecida exitosamente.');

    // Apply pending migrations at startup instead of using sequelize.sync.
    // This ensures DB schema is managed through migrations in all environments.
    try {
      const { execSync } = require('child_process');
      logger.info('Aplicando migraciones con sequelize-cli...');
      // Using npx here so the local sequelize-cli binary is used. .sequelizerc points to src/ paths.
      execSync('npx sequelize-cli db:migrate --config src/config/config.js', { stdio: 'inherit' });
      logger.info('Migraciones aplicadas correctamente.');
    } catch (mErr) {
      logger.error('Error aplicando migraciones:', mErr && mErr.message ? mErr.message : mErr);
      // No continuar si las migraciones fallan: es mejor abortar que arrancar en un estado inconsistente
      process.exit(1);
    }

    app.listen(PORT, () => {
      logger.info(`Servidor Express - Server running (port ${PORT})`);
    });

  } catch (error) {
    logger.error('Error al iniciar el servidor o la base de datos:', error && error.message ? error.message : error);
    process.exit(1); 
  }
};

startServer();