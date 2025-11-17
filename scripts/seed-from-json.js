const db = require('../src/config/database');
const logger = require('../src/utils/logger');
const fs = require('fs');
const path = require('path');

async function seedObjects() {
  const file = path.join(__dirname, '../seeds/objects.json');
  if (!fs.existsSync(file)) {
    logger.warn('[seed-from-json] No existe seeds/objects.json');
    return;
  }
  const objects = JSON.parse(fs.readFileSync(file, 'utf8'));
  const { ObjectItem } = db;
  for (const obj of objects) {
    const [objectItem, created] = await ObjectItem.findOrCreate({
      where: { objectName: obj.objectName },
      defaults: obj
    });
    if (created) {
      logger.info(`[seed-from-json] Objeto creado: ${objectItem.objectName}`);
    }
  }
  logger.info('[seed-from-json] Objetos asegurados');
}

async function seedQuests() {
  const file = path.join(__dirname, '../seeds/quests.json');
  if (!fs.existsSync(file)) {
    logger.warn('[seed-from-json] No existe seeds/quests.json');
    return;
  }
  const quests = JSON.parse(fs.readFileSync(file, 'utf8'));
  const createQuest = require('../src/utils/createQuest');
  for (const q of quests) {
    try {
      // Solo crea la quest si no existe un header con ese título
      const exists = await db.QuestsHeader.findOne({ where: { title: q.header.title } });
      if (!exists) {
        await createQuest(q); // No pasar transacción externa
        logger.info(`[seed-from-json] Quest creada: ${q.header.title}`);
      }
    } catch (err) {
      logger.error(`[seed-from-json] Error creando quest (${q.header && q.header.title}):`, err);
    }
  }
  logger.info('[seed-from-json] Quests aseguradas');
}

async function seedAll() {
  await seedObjects();
  await seedQuests();
}

module.exports = { seedAll, seedObjects, seedQuests };
