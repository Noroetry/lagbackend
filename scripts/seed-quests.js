const db = require('../src/config/database');
const logger = require('../src/utils/logger');

async function seedQuests() {
  try {
    // Ensure DB models are loaded
    const { User, ObjectItem, QuestsHeader, QuestsDetail, QuestsObject } = db;

    // 1) Create test user using the existing controller to keep behavior consistent
    const userController = require('../src/controllers/userController');
    let createdUser = null;
    const req = { body: { username: 'testuser', email: 'testuser@example.com', password: 'testpass' } };
    const res = {
      _result: null,
      status(code) {
        this._status = code;
        return this;
      },
      json(payload) {
        this._result = payload;
        return payload;
      },
      cookie() { /* noop for seed */ },
      clearCookie() { /* noop */ }
    };
    try {
      await userController.createUser(req, res);
      if (res._result && res._result.user) {
        createdUser = res._result.user;
        logger.info('Seed user (via controller):', createdUser.username || createdUser.email);
      } else {
        // fallback to DB lookup
        const [u] = await User.findOrCreate({ where: { username: 'testuser' }, defaults: { email: 'testuser@example.com', password: 'testpass' } });
        createdUser = u;
        logger.info('Seed user fallback:', createdUser.username);
      }
    } catch (err) {
      logger.warn('User create via controller failed, falling back to direct create:', err && err.message ? err.message : err);
      const [u] = await User.findOrCreate({ where: { username: 'testuser' }, defaults: { email: 'testuser@example.com', password: 'testpass' } });
      createdUser = u;
      logger.info('Seed user fallback after error:', createdUser.username);
    }

    // 2) Create experience object
    const [expObject] = await ObjectItem.findOrCreate({
      where: { objectName: 'Experiencia' },
      defaults: { description: 'Experiencia', type: 'experience' }
    });
    logger.info('Seed object:', expObject.objectName);

    // Helper to create a quest with details and objects
    async function createQuest({ header, details = [], objects = [] }) {
      const t = await db.sequelize.transaction();
      try {
        const [qh] = await QuestsHeader.findOrCreate({ where: { title: header.title }, defaults: header, transaction: t });

        // create details
        for (const d of details) {
          await QuestsDetail.findOrCreate({
            where: { idQuest: qh.id, description: d.description },
            defaults: Object.assign({}, d, { idQuest: qh.id }),
            transaction: t
          });
        }

        // create quest objects (relations)
        for (const o of objects) {
          // ensure object exists (if o.objectName provided) or use provided idObject
          let objectId = o.idObject || null;
          if (o.objectName && !objectId) {
            const [obj] = await ObjectItem.findOrCreate({ where: { objectName: o.objectName }, defaults: { type: o.type || 'experience', description: o.objectName }, transaction: t });
            objectId = obj.id;
          }

          // insert relation: idQuest, idObject, type, quantity
          if (objectId) {
            await QuestsObject.findOrCreate({
              where: { idQuest: qh.id, idObject: objectId, type: o.relType || 'R' },
              defaults: { idQuest: qh.id, idObject: objectId, type: o.relType || 'R', quantity: o.quantity || 0 },
              transaction: t
            });
          }
        }

        await t.commit();
        logger.info('Created/ensured quest:', qh.title);
        return qh;
      } catch (err) {
        await t.rollback();
        throw err;
      }
    }

    // Quest 1: single detail
    await createQuest({
      header: {
        title: 'Ejercicio Diario',
        description: 'Esta quest consiste en realizar una rutina de ejercicio diario',
        period: 'D',
        duration: 1440,
        active: true,
        levelRequired: 1,
        baseRewardXP: 50.0,
        basePenaltyXP: 25.0,
        nextQuest: null
      },
      details: [
        {
          needParam: true,
          description: 'Haz {value} sentadillas',
          labelParam: 'Squats',
          descriptionParam: 'Marque el máximo de sentadillas que es capaz de realizar en un intento.',
          isEditable: true
        }
      ],
      objects: [
        { idObject: expObject.id, relType: 'R', quantity: 100 }
      ]
    });

    // Quest 2: multiple details
    await createQuest({
      header: {
        title: 'Lectura Semanal',
        description: 'Lee diariamente durante la semana un número de páginas determinado',
        period: 'W',
        duration: 10080,
        active: true,
        levelRequired: 1,
        baseRewardXP: 30.0,
        basePenaltyXP: 10.0,
        nextQuest: null
      },
      details: [
        {
          needParam: false,
          description: 'Lee {value} páginas por día',
          labelParam: 'Páginas',
          descriptionParam: 'Número de páginas a leer cada día',
          isEditable: false
        },
        {
          needParam: false,
          description: 'Dedica {value} minutos a lectura',
          labelParam: 'Minutos',
          descriptionParam: 'Tiempo diario destinado a lectura',
          isEditable: false
        }
      ],
      objects: [
        { idObject: expObject.id, relType: 'R', quantity: 50 }
      ]
    });

    // Quest 3: multiple details and both reward and penalty objects
    await createQuest({
      header: {
        title: 'Desafío Mensual',
        description: 'Un desafío que dura un mes y que tiene varias tareas',
        period: 'M',
        duration: 43200,
        active: true,
        levelRequired: 2,
        baseRewardXP: 200.0,
        basePenaltyXP: 50.0,
        nextQuest: null
      },
      details: [
        {
          needParam: false,
          description: 'Completa {value} sesiones de entrenamiento',
          labelParam: 'Sesiones',
          descriptionParam: 'Número de sesiones a completar en el mes',
          isEditable: false
        },
        {
          needParam: false,
          description: 'Alcanza {value} minutos de actividad',
          labelParam: 'Minutos actividad',
          descriptionParam: 'Minutos totales de actividad física en el mes',
          isEditable: false
        }
      ],
      objects: [
        // reward
        { idObject: expObject.id, relType: 'R', quantity: 500 },
        // penalty
        { idObject: expObject.id, relType: 'P', quantity: 50 }
      ]
    });

    logger.info('Seed completed successfully');
  } catch (err) {
    logger.error('Seeding failed:', err && err.message ? err.message : err);
    process.exit(1);
  } finally {
    // close DB connection if possible
    try { await db.sequelize.close(); } catch (e) {}
  }
}

if (require.main === module) {
  seedQuests();
}

module.exports = seedQuests;
