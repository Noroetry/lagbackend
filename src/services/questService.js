const db = require('../config/database');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

const User = db.User;
const QuestsHeader = db.QuestsHeader;
const QuestsDetail = db.QuestsDetail;
const QuestsObject = db.QuestsObject;
const ObjectItem = db.ObjectItem;
const QuestsUser = db.QuestsUser;
const QuestsUserDetail = db.QuestsUserDetail;
const Sequelize = db.Sequelize;
const QuestsUserLog = db.QuestsUserLog;
const { QueryTypes } = db.Sequelize;

// Helper to coerce DB boolean-like values into JS boolean reliably
function coerceBool(v) {
	if (v === true) return true;
	if (v === false) return false;
	if (v === 't' || v === 'true') return true;
	if (v === 'f' || v === 'false') return false;
	if (v === 1 || v === '1') return true;
	if (v === 0 || v === '0') return false;
	return Boolean(v);
}

// Create a QuestsUser entry and corresponding QuestsUserDetail rows
async function createQuestUser(userId, questHeader, transaction = null) {
    
	// allow caller to provide a transaction; if none, create one for this operation
	const tProvided = !!transaction;
	const t = transaction || await db.sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.SERIALIZABLE });
	try {
		const details = await QuestsDetail.findAll({ where: { idQuest: questHeader.id }, transaction: t });
        
		const needsParam = details.some(d => d.needParam === true);
		const state = needsParam ? 'P' : 'N';

		const created = await QuestsUser.create({
			idUser: userId,
			idQuest: questHeader.id,
			state,
			finished: false,
			dateCreated: new Date(),
			dateRead: null,
			dateExpiration: null,
			dateFinished: null
		}, { transaction: t });

		// create detail entries
		for (const d of details) {
			await QuestsUserDetail.create({
				idUser: userId,
				idQuest: questHeader.id,
				idDetail: d.id,
				value: null,
				isChecked: false,
				dateUpdated: null
			}, { transaction: t });
		}

			if (!tProvided) {
				await t.commit();
				logger.info('[QuestService] createQuestUser committed', { userId, questId: questHeader && questHeader.id, createdId: created && created.id });
			}
			return created;
	} catch (err) {
			if (!tProvided) {
				await t.rollback();
				logger.error('[QuestService] createQuestUser rolled back', { userId, questId: questHeader && questHeader.id, error: err && err.message ? err.message : err });
			}
			throw err;
	}
}

// Assign any missing quests for the user based on level and active flag
async function assignQuestToUser(userId) {
	logger.info('[QuestService] assignQuestToUser start', { userId });
	const user = await User.findByPk(userId);
	if (!user) throw new Error('Usuario no encontrado');

    
	const candidates = await QuestsHeader.findAll({
		where: {
			active: true,
			levelRequired: { [Op.lte]: user.level }
		}
	});
	logger.info('[QuestService] assignQuestToUser - candidates fetched', { userId, candidates: candidates.length });

	const created = [];
	for (const q of candidates) {
		// Use a transaction per-creation to avoid races
		const t = await db.sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.SERIALIZABLE });
		try {
			const exists = await QuestsUser.findOne({ where: { idUser: userId, idQuest: q.id }, transaction: t, lock: t.LOCK.UPDATE });
			if (!exists) {
                
				const cu = await createQuestUser(userId, q, t);
				created.push(cu.toJSON ? cu.toJSON() : cu);
				// commit the transaction created for this candidate (createQuestUser used the same transaction)
				await t.commit();
				logger.info('[QuestService] assignQuestToUser - quest assigned', { userId, questId: q.id, createdId: cu && cu.id });
				continue;
			} else {
                
				await t.commit();
			}
		} catch (err) {
			try { await t.rollback(); } catch (e) {}
			logger.error('[QuestService] assignQuestToUser error for quest', { questId: q.id, error: err && err.message ? err.message : err });
		}
	}
	return created;
}

// Process completion or expiration rewards for a given QuestsUser record
async function processQuestCompletion(userId, questUser) {
	logger.info('[QuestService] processQuestCompletion start', { userId, questUserId: questUser.id, questId: questUser.idQuest, state: questUser.state });
	const rewards = [];
	const t = await db.sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.SERIALIZABLE });
	try {
		// reload questUser with lock to avoid concurrent processing
		const qu = await QuestsUser.findOne({ where: { id: questUser.id }, transaction: t, lock: t.LOCK.UPDATE });
		if (!qu) throw new Error('QuestsUser record no encontrado');
		// If already finalized, skip
		if (qu.state === 'F' && qu.finished) {
			await t.commit();
			logger.info('[QuestService] processQuestCompletion - already finalized, skipping', { questUserId: qu.id });
			return { idQuest: qu.idQuest, state: qu.state, objects: [] };
		}

		const questObjects = await QuestsObject.findAll({ where: { idQuest: qu.idQuest }, transaction: t });
        
		const user = await User.findByPk(userId, { transaction: t, lock: t.LOCK.UPDATE });
		if (!user) throw new Error('Usuario no encontrado');

		for (const qo of questObjects) {
			// qo.type indicates R (reward), P (penalty), A (all)
			const qoType = (qo.type || 'R').toUpperCase();
			// Determine whether this object should be applied depending on quest state
			const applyForCompleted = qoType === 'R' || qoType === 'A';
			const applyForExpired = qoType === 'P' || qoType === 'A';

			let shouldApply = false;
			if (qu.state === 'C' && applyForCompleted) shouldApply = true;
			if (qu.state === 'E' && applyForExpired) shouldApply = true;
			if (!shouldApply) continue;

			const item = await ObjectItem.findByPk(qo.idObject, { transaction: t });
			if (!item) continue;
			const itemType = (item.type || '').toLowerCase();
			const quantity = Number(qo.quantity) || 0;

			if (itemType === 'experience' || itemType === 'experiencie') {
				const toAdd = Math.round(quantity);
                
				// increment using transaction
				await user.increment({ totalExp: toAdd }, { transaction: t });
				rewards.push({ type: 'experience', quantity: toAdd, appliedAs: qoType });
			} else {
                
				rewards.push({ type: item.type, quantity, appliedAs: qoType });
			}
		}

			// Create a log entry for this finalized quest (result depends on prior state C or E)
			try {
				const resultChar = (qu.state === 'C') ? 'C' : (qu.state === 'E' ? 'E' : null);
				if (resultChar && QuestsUserLog) {
                    
					await createQuestUserLog(userId, qu.idQuest, resultChar, rewards, t);
					logger.info('[QuestService] processQuestCompletion - quest user log created', { userId, questId: qu.idQuest });
				}
			} catch (logErr) {
				// If logging fails, roll back the whole transaction to avoid partial state
				logger.error('[QuestService] Failed to create quest user log, rolling back:', logErr && logErr.message ? logErr.message : logErr);
				throw logErr;
			}

			// Mark quest user as finalized
			qu.state = 'F';
			qu.finished = true;
			qu.dateFinished = new Date();
			await qu.save({ transaction: t });

			await t.commit();
			logger.info('[QuestService] processQuestCompletion committed', { userId, questId: qu.idQuest, rewardsCount: rewards.length });
			return { idQuest: qu.idQuest, state: 'F', objects: rewards };
	} catch (err) {
		try { await t.rollback(); } catch (e) {}
		throw err;
	}
}

	// Create a persistent log entry for a finalized quest. If `transaction` is provided,
	// the creation will be part of that transaction.
	async function createQuestUserLog(userId, questId, result, rewards = null, transaction = null) {
		const logData = {
			idUser: userId,
			idQuest: questId,
			result: result,
			rewards: rewards || null,
			dateFinished: new Date(),
			meta: null
		};
		if (transaction) {
			return await QuestsUserLog.create(logData, { transaction });
		}
		return await QuestsUserLog.create(logData);
	}

// Check expiration or completion for quests of a user and process them
async function updateQuestStates(userId) {
	logger.info('[QuestService] updateQuestStates start', { userId });
	const results = [];
	const now = new Date();

	const questUsers = await QuestsUser.findAll({ where: { idUser: userId, state: { [Op.in]: ['C', 'E', 'L'] } } });
	logger.info('[QuestService] updateQuestStates - questUsers fetched', { userId, count: questUsers.length });
	for (const qu of questUsers) {
		try {
            
			if (qu.state === 'C' || qu.state === 'E') {
				const res = await processQuestCompletion(userId, qu);
				results.push(res);
				continue;
			}

			if (qu.state === 'L') {
				// check expiration
				if (qu.dateExpiration && new Date(qu.dateExpiration) < now) {
					qu.state = 'E';
					await qu.save();
					const res = await processQuestCompletion(userId, qu);
					results.push(res);
					continue;
				}

				// check if completed by verifying all details checked
				const details = await QuestsUserDetail.findAll({ where: { idUser: userId, idQuest: qu.idQuest } });
				const allChecked = details.length > 0 && details.every(d => d.isChecked === true);
				if (allChecked) {
					qu.state = 'C';
					await qu.save();
					const res = await processQuestCompletion(userId, qu);
					logger.info('[QuestService] updateQuestStates - marked completed', { questUserId: qu.id, questId: qu.idQuest });
					results.push(res);
				}
			}
		} catch (err) {
			logger.error('[QuestService] Error processing questUser', { questUserId: qu.id, error: err && err.message ? err.message : err });
		}
	}

	return results;
}

// Return active quests for a user with details
async function getActiveQuestsForUser(userId) {
    
	const active = [];
	const quests = await QuestsUser.findAll({ where: { idUser: userId, state: { [Op.in]: ['N', 'P', 'L'] } } });
	logger.info('[QuestService] getActiveQuestsForUser - quests fetched', { userId, count: quests.length });
	for (const q of quests) {
		const details = await QuestsUserDetail.findAll({ where: { idUser: userId, idQuest: q.idQuest } });
        
		const formattedDetails = await Promise.all(details.map(async d => {
			// get template description
			const template = await QuestsDetail.findByPk(d.idDetail);
			return {
				idDetail: d.idDetail,
				description: template ? template.description : null,
				needParam: template ? template.needParam : false,
				checked: !!d.isChecked,
				paramValue: d.value
			};
		}));

		active.push({
			idQuest: q.idQuest,
			state: q.state,
			dateCreated: q.dateCreated,
			dateExpiration: q.dateExpiration,
			details: formattedDetails
		});
	}

	return active;
}

// Fetch assigned/active quests for a user in a single optimized query using JOINs
// Returns an array of quest objects formatted for frontend consumption
async function getUserQuests(userId) {
	logger.info('[QuestService] getUserQuests start', { userId });
		const sql = `
			SELECT
				"uq"."id" AS quest_user_id,
				"uq"."idQuest" AS quest_id,
				"uq"."state" AS quest_state,
				"uq"."dateRead" AS date_read,
				"uq"."dateExpiration" AS date_expiration,
				"h"."id" AS header_id,
				"h"."title" AS header_title,
				"h"."description" AS header_description,
				"h"."period" AS header_period,
				"h"."duration" AS header_duration,
				"ud"."id" AS user_detail_id,
				"ud"."idDetail" AS detail_id,
				"ud"."value" AS detail_value,
				"ud"."isChecked" AS detail_checked,
				"d"."id" AS detail_template_id,
				"d"."needParam" AS "detail_needParam",
				"d"."description" AS detail_description,
				"d"."labelParam" AS "detail_labelParam",
				"d"."descriptionParam" AS "detail_descriptionParam",
				"d"."isEditable" AS "detail_isEditable"
			FROM "quests_users" AS "uq"
			LEFT JOIN "quests_headers" AS "h" ON "h"."id" = "uq"."idQuest"
			LEFT JOIN "quests_users_detail" AS "ud" ON "ud"."idUser" = "uq"."idUser" AND "ud"."idQuest" = "uq"."idQuest"
			LEFT JOIN "quests_details" AS "d" ON "d"."id" = "ud"."idDetail"
			WHERE "uq"."idUser" = :userId AND "uq"."state" IN ('N','P','L')
			ORDER BY "uq"."id", "ud"."id"
		`;

	const rows = await db.sequelize.query(sql, {
		replacements: { userId },
		type: QueryTypes.SELECT
	});

	// If some detail template columns are missing in the raw rows (d.* came back null/undefined),
	// fetch those templates in batch to ensure we have needParam/isEditable/description values.
	const missingDetailIds = new Set();
	for (const r of rows) {
		// if there is a user detail but no template fields, mark to fetch
		if (r.user_detail_id && (r.detail_template_id === null || typeof r.detail_template_id === 'undefined')) {
			if (r.detail_id) missingDetailIds.add(r.detail_id);
		}
	}

	let templateMap = {};
	if (missingDetailIds.size > 0) {
		const ids = Array.from(missingDetailIds);
		logger.warn('[QuestService] getUserQuests - missing detail templates in raw join, fetching separately', { userId, missingCount: ids.length, ids });
		const templates = await QuestsDetail.findAll({ where: { id: ids } });
		for (const t of templates) {
			templateMap[t.id] = t; // store model instance
		}
		logger.debug('[QuestService] getUserQuests - fetched missing templates', { userId, fetched: Object.keys(templateMap).length });
	}

	const map = new Map();
	for (const r of rows) {
		const qid = r.quest_user_id;
		if (!map.has(qid)) {
					map.set(qid, {
						id: qid,
				header: {
					id: r.header_id,
					title: r.header_title,
					description: r.header_description,
					period: r.header_period,
					duration: r.header_duration
				},
				state: r.quest_state,
				dateRead: r.date_read,
				dateExpiration: r.date_expiration,
				details: []
			});
		}

		if (r.user_detail_id) {
				const entry = map.get(qid);
				// Log raw values as returned by the DB for debugging
      

						// If template fields were not present in the raw row, try to pick them from templateMap
						const templateFromMap = (r.detail_id && templateMap && templateMap[r.detail_id]) ? templateMap[r.detail_id] : null;
						const mappedDetail = {
							id: r.user_detail_id,
							idDetail: r.detail_id,
							description: r.detail_description || (templateFromMap ? templateFromMap.description : null),
							needParam: (typeof r.detail_needParam !== 'undefined' && r.detail_needParam !== null) ? coerceBool(r.detail_needParam) : (templateFromMap ? coerceBool(templateFromMap.needParam) : false),
							labelParam: r.detail_labelParam || (templateFromMap ? templateFromMap.labelParam : null),
							descriptionParam: r.detail_descriptionParam || (templateFromMap ? templateFromMap.descriptionParam : null),
							isEditable: (typeof r.detail_isEditable !== 'undefined' && r.detail_isEditable !== null) ? coerceBool(r.detail_isEditable) : (templateFromMap ? coerceBool(templateFromMap.isEditable) : false),
							value: r.detail_value,
							checked: coerceBool(r.detail_checked)
						};

      

				entry.details.push(mappedDetail);
		}
	}

	// If no rows returned, fallback to simple fetch (no details present)
	if (map.size === 0) {
		const uq = await QuestsUser.findAll({ where: { idUser: userId, state: { [Op.in]: ['N','P','L'] } }, include: [{ model: QuestsHeader }] });
		for (const q of uq) {
					map.set(q.id, {
						id: q.id,
				header: q.QuestsHeader ? {
					id: q.QuestsHeader.id,
					title: q.QuestsHeader.title,
					description: q.QuestsHeader.description,
					period: q.QuestsHeader.period,
					duration: q.QuestsHeader.duration
				} : null,
				state: q.state,
				dateRead: q.dateRead,
				dateExpiration: q.dateExpiration,
				details: []
			});
		}
	}

	const result = Array.from(map.values());
	logger.info('[QuestService] getUserQuests completed', { userId, count: result.length });
	return result;
}

module.exports = {
	assignQuestToUser,
	createQuestUser,
	updateQuestStates,
	processQuestCompletion,
	getActiveQuestsForUser,
	getUserQuests
};
