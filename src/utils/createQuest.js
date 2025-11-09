const db = require('../config/database');
const logger = require('./logger');

/**
 * Crea una quest completa (header + details + objects) en una transacción.
 *
 * payload = {
 *   header: { title, description, period?, duration?, active?, levelRequired?, baseRewardXP?, basePenaltyXP?, nextQuest? },
 *   details: [ { needParam?, description, labelParam?, descriptionParam?, isEditable?, paramType? } ],
 *   objects: [ { idObject? or objectName?, type?, quantity?, description? , typeItem? } ]
 * }
 *
 * - Si un objeto en `objects` incluye `idObject` se usa ese id.
 * - Si no incluye `idObject` pero sí `objectName`, se busca o crea un ObjectItem con ese nombre.
 * - La función es transaccional; si ocurre un error se hace rollback.
 *
 * Retorna el QuestsHeader creado con relaciones (details y objects + objectItems).
 */
async function createQuest(payload = {}, externalTransaction = null) {
  const tProvided = !!externalTransaction;
  const t = externalTransaction || await db.sequelize.transaction({ isolationLevel: db.Sequelize.Transaction.ISOLATION_LEVELS.SERIALIZABLE });

  try {
    if (!payload || typeof payload !== 'object') throw new Error('Payload inválido');

    const headerPayload = payload.header || {};
    const { title, description } = headerPayload;
    if (!title || !description) throw new Error('Los campos `title` y `description` del header son obligatorios');

    // Prepare header defaults consistent with model defaults
    const newHeader = await db.QuestsHeader.create({
      title: String(title),
      description: String(description),
      welcomeMessage: typeof headerPayload.welcomeMessage !== 'undefined' ? headerPayload.welcomeMessage : null,
      period: headerPayload.period || 'D',
      duration: typeof headerPayload.duration !== 'undefined' ? headerPayload.duration : 1440,
      active: typeof headerPayload.active !== 'undefined' ? !!headerPayload.active : true,
      levelRequired: typeof headerPayload.levelRequired !== 'undefined' ? headerPayload.levelRequired : 1,
      baseRewardXP: typeof headerPayload.baseRewardXP !== 'undefined' ? headerPayload.baseRewardXP : 0.0,
      basePenaltyXP: typeof headerPayload.basePenaltyXP !== 'undefined' ? headerPayload.basePenaltyXP : 0.0,
      nextQuest: typeof headerPayload.nextQuest !== 'undefined' ? headerPayload.nextQuest : null
    }, { transaction: t });

    // Create details
    if (Array.isArray(payload.details)) {
      for (const d of payload.details) {
        if (!d || typeof d !== 'object') continue;
        const detailData = {
          idQuest: newHeader.id,
          needParam: !!d.needParam,
          description: d.description || '',
          labelParam: d.labelParam || null,
          descriptionParam: d.descriptionParam || null,
          isEditable: !!d.isEditable,
          paramType: d.paramType || 'number'
        };
        await db.QuestsDetail.create(detailData, { transaction: t });
      }
    }

    // Create objects (and object items if needed)
    if (Array.isArray(payload.objects)) {
      for (const o of payload.objects) {
        if (!o || typeof o !== 'object') continue;

        let idObject = o.idObject;

        if (!idObject) {
          if (!o.objectName) {
            throw new Error('Cada objeto debe incluir `idObject` o `objectName`');
          }
          // Find or create ObjectItem
          const [objItem] = await db.ObjectItem.findOrCreate({
            where: { objectName: o.objectName },
            defaults: {
              description: o.description || null,
              shortName: typeof o.shortName !== 'undefined' ? o.shortName : null,
              type: o.typeItem || (o.type ? (o.type === 'R' || o.type === 'P' || o.type === 'A' ? 'misc' : 'experience') : 'experience')
            },
            transaction: t
          });
          idObject = objItem.id;
        }

        await db.QuestsObject.create({
          idQuest: newHeader.id,
          idObject,
          type: (o.type || 'R'),
          quantity: typeof o.quantity !== 'undefined' ? o.quantity : 0
        }, { transaction: t });
      }
    }

    if (!tProvided) {
      await t.commit();
      logger.info('[createQuest] committed transaction', { questId: newHeader.id });
    }

    // Return header with relations
    const headerWithRelations = await db.QuestsHeader.findByPk(newHeader.id, {
      include: [
        { model: db.QuestsDetail },
        { model: db.QuestsObject, include: [ db.ObjectItem ] }
      ]
    });

    return headerWithRelations;
  } catch (err) {
    if (!tProvided) {
      try { await t.rollback(); } catch (e) { logger.error('[createQuest] rollback failed', e && e.message ? e.message : e); }
      logger.error('[createQuest] rolled back', { error: err && err.message ? err.message : err });
    }
    throw err;
  }
}

module.exports = createQuest;
