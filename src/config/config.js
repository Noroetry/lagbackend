// Cargar variables de entorno (si dotenv está disponible en el entorno de ejecución)
try {
  require('dotenv').config();
} catch (err) {
  // dotenv no está instalado en este entorno (por ejemplo, producción donde no se incluyeron devDeps)
}

// Determinar qué DATABASE_URL usar según el entorno
const isProduction = process.env.NODE_ENV === 'production';
const databaseUrl = isProduction 
  ? (process.env.DATABASE_URL_PRODUCTION || process.env.DATABASE_URL)
  : process.env.DATABASE_URL;

const hasDatabaseUrl = !!databaseUrl;

// Build a config object that works for all environments
const envConfigFromUrl = {
  use_env_variable: isProduction ? 'DATABASE_URL_PRODUCTION' : 'DATABASE_URL',
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