// Cargar variables de entorno (si dotenv está disponible en el entorno de ejecución)
try {
  require('dotenv').config();
} catch (err) {
  // dotenv no está instalado en este entorno (por ejemplo, producción donde no se incluyeron devDeps)
}

const hasDatabaseUrl = !!process.env.DATABASE_URL;

// Build a config object that works for all environments
const envConfigFromUrl = {
  use_env_variable: 'DATABASE_URL',
  dialect: process.env.DB_DIALECT || 'postgres',
  dialectOptions: (process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false')
    ? { ssl: { rejectUnauthorized: true } }
    : { ssl: { rejectUnauthorized: false } }
};

const envConfigFromParts = {
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  dialect: process.env.DB_DIALECT || 'postgres'
};

const selectedConfig = hasDatabaseUrl ? envConfigFromUrl : envConfigFromParts;

module.exports = {
  development: selectedConfig,
  test: selectedConfig,
  production: selectedConfig,
};