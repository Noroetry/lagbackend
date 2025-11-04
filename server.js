
const app = require('./src/app'); 
const db = require('./src/config/database'); 

const PORT = process.env.PORT || 3000; 

const startServer = async () => {
  try {
    await db.sequelize.authenticate();
    const logger = require('./src/utils/logger');
    logger.info('Conexión a la base de datos PostgreSQL establecida exitosamente.');

    await db.sequelize.sync({ alter: true }); 
    logger.info('Tablas sincronizadas (Modelos cargados).');

    // Optionally seed system user at startup. Use SEED_ON_STARTUP env var (default true in dev .env)
    try {
      const seedOnStart = (process.env.SEED_ON_STARTUP || 'true') === 'true';
      if (seedOnStart) {
        const ensureSystemUser = require('./scripts/seed-system');
        await ensureSystemUser();
        logger.info('System seed executed at startup');
      } else {
        logger.info('SEED_ON_STARTUP disabled; skipping system seed');
      }
    } catch (err) {
      logger.error('Error running system seed:', err && err.message ? err.message : err);
      // don't abort startup if seeding fails in non-production; in production seed failure should be fatal
      if (process.env.NODE_ENV === 'production') process.exit(1);
    }

    app.listen(PORT, () => {
      logger.info(`Servidor Express escuchando en http://localhost:${PORT}`);
    });

  } catch (error) {
    const logger = require('./src/utils/logger');
    logger.error('Error al iniciar el servidor o la base de datos:', error && error.message ? error.message : error);
    process.exit(1); 
  }
};

startServer();