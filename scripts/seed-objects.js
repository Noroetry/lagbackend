const db = require('../src/config/database');
const logger = require('../src/utils/logger');
const SYSTEM_OBJECTS = require('../src/config/system/objects');

/**
 * Asegura que los objetos del sistema existan en la base de datos
 * Se ejecuta automáticamente al iniciar la aplicación
 * 
 * Los objetos están definidos en: src/config/system/objects.js
 */
async function ensureSystemObjects() {
  try {
    const { ObjectItem } = db;
    
    logger.info('🔍 Verificando objetos del sistema...');
    
    for (const obj of SYSTEM_OBJECTS) {
      const [objectItem, created] = await ObjectItem.findOrCreate({
        where: { objectName: obj.objectName },
        defaults: {
          shortName: obj.shortName,
          description: obj.description,
          type: obj.type
        }
      });

      if (created) {
        logger.info(`✓ Objeto creado: ${objectItem.objectName} (${objectItem.type})`);
      } else {
        logger.debug(`✓ Objeto ya existe: ${objectItem.objectName}`);
      }
    }
    
    logger.info('✅ Objetos del sistema verificados correctamente');
  } catch (error) {
    logger.error('❌ Error al verificar objetos del sistema:', error);
    throw error;
  }
}

module.exports = ensureSystemObjects;
