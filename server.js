
const app = require('./src/app'); 
const db = require('./src/config/database');
const logger = require('./src/utils/logger');
const ensureSystemObjects = require('./scripts/seed-objects');

const PORT = process.env.PORT || 3000; 

const startServer = async () => {
  try {
    await db.sequelize.authenticate();

    // Apply pending migrations at startup instead of using sequelize.sync.
    // This ensures DB schema is managed through migrations in all environments.
    try {
      const { execSync } = require('child_process');
      // Using npx here so the local sequelize-cli binary is used. .sequelizerc points to src/ paths.
      execSync('npx sequelize-cli db:migrate --config src/config/config.js', { stdio: 'inherit' });
    } catch (mErr) {
      logger.error('Error aplicando migraciones:', mErr && mErr.message ? mErr.message : mErr);
      // No continuar si las migraciones fallan: es mejor abortar que arrancar en un estado inconsistente
      process.exit(1);
    }

    // Ensure system objects exist after migrations
    try {
      await ensureSystemObjects();
    } catch (seedErr) {
      logger.error('Error al crear objetos del sistema:', seedErr && seedErr.message ? seedErr.message : seedErr);
      // This is not critical, so we can continue
    }

    app.listen(PORT, () => {
      logger.info(`Servidor iniciado en puerto ${PORT}`);
    });

  } catch (error) {
    logger.error('Error al iniciar el servidor o la base de datos:', error && error.message ? error.message : error);
    process.exit(1); 
  }
};

startServer();