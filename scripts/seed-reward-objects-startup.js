const db = require('../src/config/database');
const ObjectItem = db.ObjectItem;
const logger = require('../src/utils/logger');

/**
 * Asegura que los objetos de recompensa base existan en la base de datos.
 * Se ejecuta al inicio del servidor para garantizar que los objetos necesarios estén disponibles.
 */
async function ensureRewardObjects() {
  try {
    // Experiencia
    const [exp] = await ObjectItem.findOrCreate({
      where: { type: 'experience' },
      defaults: {
        objectName: 'Experiencia',
        shortName: 'EXP',
        description: 'Puntos de experiencia del jugador',
        type: 'experience'
      }
    });
    logger.info(`Objeto de recompensa verificado: Experiencia (ID: ${exp.id})`);

    // Moneda
    const [coin] = await ObjectItem.findOrCreate({
      where: { type: 'coin' },
      defaults: {
        objectName: 'Moneda',
        shortName: 'COIN',
        description: 'Monedas del juego',
        type: 'coin'
      }
    });
    logger.info(`Objeto de recompensa verificado: Moneda (ID: ${coin.id})`);

    // Quest
    const [quest] = await ObjectItem.findOrCreate({
      where: { type: 'quest' },
      defaults: {
        objectName: 'Misión',
        shortName: 'QUEST',
        description: 'Asigna una misión especial al usuario',
        type: 'quest'
      }
    });
    logger.info(`Objeto de recompensa verificado: Misión (ID: ${quest.id})`);

    logger.info('✓ Objetos de recompensa base verificados exitosamente');
  } catch (error) {
    logger.error('Error al verificar objetos de recompensa:', error.message);
    throw error;
  }
}

module.exports = ensureRewardObjects;
