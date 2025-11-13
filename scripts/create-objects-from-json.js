const db = require('../src/config/database');
const logger = require('../src/utils/logger');
const fs = require('fs');
const path = require('path');

/**
 * Script para crear ObjectItems desde un archivo JSON
 * Uso: node scripts/create-objects-from-json.js [archivo.json]
 */
async function createObjectsFromJson() {
  try {
    const { ObjectItem } = db;

    // Leer el archivo JSON (por defecto objects-template.json)
    const jsonFile = process.argv[2] || 'objects-template.json';
    const jsonPath = path.join(__dirname, jsonFile);
    
    if (!fs.existsSync(jsonPath)) {
      logger.error(`❌ Archivo no encontrado: ${jsonPath}`);
      process.exit(1);
    }

    const objectsData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    
    logger.info(`📦 Creando ${objectsData.length} objetos...`);

    for (const obj of objectsData) {
      const [objectItem, created] = await ObjectItem.findOrCreate({
        where: { objectName: obj.objectName },
        defaults: {
          shortName: obj.shortName || null,
          description: obj.description,
          type: obj.type
        }
      });

      if (created) {
        logger.info(`✓ Creado: ${objectItem.objectName} (${objectItem.type})`);
      } else {
        logger.info(`⚠ Ya existe: ${objectItem.objectName}`);
      }
    }

    logger.info('✅ Proceso completado');
    process.exit(0);
  } catch (err) {
    logger.error('❌ Error creando objetos:', err);
    process.exit(1);
  }
}

createObjectsFromJson();
