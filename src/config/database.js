const { Sequelize, DataTypes } = require('sequelize');
const fs = require('fs');
const path = require('path');

// Cargar variables de entorno desde .env SOLO en desarrollo/local
if (process.env.NODE_ENV !== 'production') {
  try {
    require('dotenv').config();
    console.log('[Database] dotenv cargado para entorno de desarrollo');
  } catch (err) {
    console.warn('[Database] dotenv no está instalado o no pudo cargarse:', err.message);
  }
}

// Configuración unificada de Sequelize.
// Preferimos `DATABASE_URL` si está presente (útil para Neon en local y en hosting).
const defaultPool = {
  max: 5,
  min: 0,
  acquire: 30000,
  idle: 10000
};

// Opciones base para conexión con URL (asumimos SSL requerido en providers como Neon)
const urlOptions = {
  dialect: 'postgres',
  dialectOptions: {
    ssl: {
      require: true,
      // Por defecto true; se puede forzar false con DB_SSL_REJECT_UNAUTHORIZED=false en .env si es necesario
      rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false'
    }
  },
  pool: defaultPool,
  logging: process.env.NODE_ENV === 'development'
};

// Opciones para conexión por credenciales separadas (dev)
const credsOptions = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
  dialect: process.env.DB_DIALECT || 'postgres',
  logging: process.env.NODE_ENV === 'development',
  define: {
    timestamps: true,
    underscored: true,
  },
  pool: defaultPool
};

let sequelize;
if (process.env.DATABASE_URL) {
  // Si existe DATABASE_URL, úsala (tanto en local como en producción). Ideal para Neon.
  sequelize = new Sequelize(process.env.DATABASE_URL, urlOptions);
} else if (process.env.NODE_ENV === 'production') {
  // En producción sin DATABASE_URL, cae hacia un objeto de configuración que requiera env vars
  sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, urlOptions);
} else {
  // Desarrollo local con vars separadas
  sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    credsOptions
  );
}

const db = {};

fs.readdirSync(path.join(__dirname, '../models')) 
  .filter(file => {
    return (
      file.indexOf('.') !== 0 &&
      file.slice(-3) === '.js' 
    );
  })
  .forEach(file => {
    const model = require(path.join(__dirname, '../models', file))(sequelize, DataTypes);
    db[model.name] = model;
  });

Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;