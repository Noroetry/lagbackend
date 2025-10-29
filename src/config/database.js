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

const sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    // Neon ya requiere SSL, pero a veces necesitas configuraciones adicionales
    dialectOptions: {
        ssl: {
            require: true, 
            rejectUnauthorized: false // Usar si da problemas con certificados
        }
    }
});

const sequelizeLocal = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
        dialect: process.env.DB_DIALECT,
        logging: false, 
        define: {
            timestamps: true, 
            underscored: true, 
        },
    }
);

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