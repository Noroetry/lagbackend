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

// Opciones de SSL según el entorno
const sslOptions = (process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false')
  ? { ssl: { rejectUnauthorized: true } }
  : { ssl: { rejectUnauthorized: false } };

// Build a config object that works for all environments
let selectedConfig;

if (hasDatabaseUrl) {
  // Si tenemos DATABASE_URL, usamos use_env_variable
  selectedConfig = {
    use_env_variable: isProduction ? 'DATABASE_URL_PRODUCTION' : 'DATABASE_URL',
    dialect: process.env.DB_DIALECT || 'postgres',
    dialectOptions: sslOptions
  };
} else {
  // Si no tenemos DATABASE_URL, usamos credenciales separadas
  selectedConfig = {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
    dialect: process.env.DB_DIALECT || 'postgres',
    dialectOptions: sslOptions
  };
}

module.exports = {
  development: selectedConfig,
  test: selectedConfig,
  production: selectedConfig,
};