require('dotenv').config(); // Cargar variables de entorno

const hasDatabaseUrl = !!process.env.DATABASE_URL;

module.exports = {
  development: hasDatabaseUrl
    ? {
        // Si existe DATABASE_URL preferimos usarla para mantener parity entre app y sequelize-cli
        use_env_variable: 'DATABASE_URL',
        dialect: process.env.DB_DIALECT || 'postgres',
        dialectOptions: {
          ssl: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' ? { rejectUnauthorized: true } : { rejectUnauthorized: false }
        }
      }
    : {
        username: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        dialect: process.env.DB_DIALECT || 'postgres',
      },
};