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
const { processQuestRewards } = require('./rewardService');

function computeNextExpiration(period, fromDate = null) {
	const now = fromDate ? new Date(fromDate) : new Date();
	// base target set to today at 03:00
	const target = new Date(now);
	target.setHours(3, 0, 0, 0);

	if (now < target) {
		return target;
	}

	const p = (period || 'D').toUpperCase();
	if (p === 'D' || p === 'R') {
		target.setDate(target.getDate() + 1);
		return target;
	}
	if (p === 'W') {
		target.setDate(target.getDate() + 7);
		return target;
	}
	if (p === 'M') {
		const month = target.getMonth();
		target.setMonth(month + 1);
		return target;
	}

	target.setDate(target.getDate() + 1);
	return target;
}

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
			logger.info('[QuestService] saveQuestParams - committed transaction successfully', { userId, idQuest, updatedCount: updated.length });
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

			// Call external rewards processor. For now this stub will mark rewardDelivered = true.
			try {
				if (typeof processQuestRewards === 'function') {
					await processQuestRewards(qu, t);
					logger.info('[QuestService] processQuestCompletion - processQuestRewards executed', { userId, questId: qu.idQuest, questUserId: qu.id });
				}
			} catch (prErr) {
				logger.error('[QuestService] processQuestCompletion - processQuestRewards failed', { error: prErr && prErr.message ? prErr.message : prErr });
				throw prErr;
			}

			// If quest is periodic (period != 'U'), handle reschedule differently from non-periodic.
			// Periodic quests should never end in state 'F'.
			try {
				const header = await QuestsHeader.findByPk(qu.idQuest, { transaction: t });
				const period = header && header.period ? String(header.period).toUpperCase() : 'U';
				if (period !== 'U') {
					// compute next expiration at 03:00 according to period
					const nextExp = computeNextExpiration(period, new Date());
					if (qu.state === 'E') {
						// expired quests: reschedule immediately and reset details for the next cycle
						try {
							await QuestsUserDetail.update({ isChecked: false, dateUpdated: new Date() }, { where: { idUser: userId, idQuest: qu.idQuest }, transaction: t });
							logger.info('[QuestService] processQuestCompletion - reset quest details to unchecked (periodic, expired)', { userId, questId: qu.idQuest });
						} catch (e) {
							logger.warn('[QuestService] processQuestCompletion - failed to reset quest details', { userId, questId: qu.idQuest, error: e && e.message ? e.message : e });
						}
						// Reschedule to live state for the next cycle
						qu.state = 'L';
						qu.finished = false;
						qu.dateFinished = null;
						qu.dateRead = new Date();
						qu.dateExpiration = nextExp;
						await qu.save({ transaction: t });
						logger.info('[QuestService] processQuestCompletion - quest rescheduled (periodic, expired)', { userId, questId: qu.idQuest, period, nextExpiration: nextExp });
					} else if (qu.state === 'C') {
						// completed quests: award now but keep in 'C' state, mark finished=true so it won't be reprocessed
						qu.finished = true;
						qu.dateFinished = new Date();
						qu.dateExpiration = nextExp; // set when it should next reactivate
						await qu.save({ transaction: t });
						logger.info('[QuestService] processQuestCompletion - periodic quest awarded and scheduled for reactivation', { userId, questId: qu.idQuest, period, nextExpiration: nextExp });
					} else {
						// fallback: mark as finished but keep state C
						qu.finished = true;
						qu.dateFinished = new Date();
						qu.dateExpiration = nextExp;
						await qu.save({ transaction: t });
					}
				} else {
					qu.state = 'F';
					qu.finished = true;
					qu.dateFinished = new Date();
					await qu.save({ transaction: t });
				}
			} catch (reschedErr) {
				// Any error rescheduling should roll back to avoid inconsistent state
				logger.error('[QuestService] processQuestCompletion - failed to reschedule or finalize', { error: reschedErr && reschedErr.message ? reschedErr.message : reschedErr });
				throw reschedErr;
			}

			await t.commit();
			logger.info('[QuestService] processQuestCompletion committed', { userId, questId: qu.idQuest, rewardsCount: rewards.length });
			return { idQuest: qu.idQuest, state: qu.state, objects: rewards };
	} catch (err) {
		logger.error('[QuestService] saveQuestParams - caught exception, rolling back', { error: err && err.message ? err.message : err, stack: err && err.stack ? err.stack : undefined });
		try { await t.rollback(); } catch (e) { logger.error('[QuestService] saveQuestParams - rollback failed', { error: e && e.message ? e.message : e }); }
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

	// Include 'F' so we can reactivate periodic quests that were previously finalized
	const questUsers = await QuestsUser.findAll({ where: { idUser: userId, state: { [Op.in]: ['C', 'E', 'L', 'F'] } } });
	logger.info('[QuestService] updateQuestStates - questUsers fetched', { userId, count: questUsers.length });
	for (const qu of questUsers) {
		try {
            
			if (qu.state === 'C') {
				// Only process completion if it hasn't been processed yet (finished !== true)
				if (!qu.finished) {
					const res = await processQuestCompletion(userId, qu);
					results.push(res);
				}
				continue;
			}

			if (qu.state === 'E') {
				const res = await processQuestCompletion(userId, qu);
				results.push(res);
				continue;
			}

			// If a quest is in state 'F' but the header says it's periodic, reactivate it
			if (qu.state === 'F') {
				try {
					const header = await QuestsHeader.findByPk(qu.idQuest);
					const period = header && header.period ? String(header.period).toUpperCase() : 'U';
					if (period !== 'U') {
						// Only reactivate when the stored dateExpiration has arrived
						if (qu.dateExpiration && new Date(qu.dateExpiration) <= now) {
							const nextExp = computeNextExpiration(period, new Date());
							// reset details to unchecked when reactivating
							try {
								await QuestsUserDetail.update({ isChecked: false, dateUpdated: new Date() }, { where: { idUser: qu.idUser, idQuest: qu.idQuest } });
								logger.info('[QuestService] updateQuestStates - reset details on reactivate', { questUserId: qu.id, questId: qu.idQuest });
							} catch (e) {
								logger.warn('[QuestService] updateQuestStates - failed to reset details on reactivate', { questUserId: qu.id, questId: qu.idQuest, error: e && e.message ? e.message : e });
							}
							qu.state = 'L';
							qu.finished = false;
							qu.dateFinished = null;
							qu.dateRead = new Date();
							qu.dateExpiration = nextExp;
							await qu.save();
							results.push({ idQuest: qu.idQuest, state: 'L', rescheduled: true, nextExpiration: nextExp });
						}
					}
				} catch (e) {
					logger.error('[QuestService] updateQuestStates - failed to reactivate periodic F quest', { questUserId: qu.id, error: e && e.message ? e.message : e });
				}
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
				idQuestUserDetail: d.id,
				idDetail: d.idDetail,
				description: template ? template.description : null,
				needParam: template ? template.needParam : false,
				paramType: (template && typeof template.paramType !== 'undefined' && template.paramType !== null) ? template.paramType : 'string',
				isEditable: (template && typeof template.isEditable !== 'undefined') ? template.isEditable : false,
				labelParam: template ? template.labelParam : null,
				descriptionParam: template ? template.descriptionParam : null,
				value: d.value,
				checked: !!d.isChecked
			};
		}));

		active.push({
			idQuestUser: q.id,
			header: {
				idQuestHeader: q.idQuest,
				// Note: q may not have header fields here; keep the header minimal
				welcomeMessage: null
			},
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
				"h"."welcomeMessage" AS header_welcome_message,
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
				"d"."isEditable" AS "detail_isEditable",
				"d"."paramType" AS "detail_paramType"
			FROM "quests_users" AS "uq"
			LEFT JOIN "quests_headers" AS "h" ON "h"."id" = "uq"."idQuest"
			LEFT JOIN "quests_users_detail" AS "ud" ON "ud"."idUser" = "uq"."idUser" AND "ud"."idQuest" = "uq"."idQuest"
			LEFT JOIN "quests_details" AS "d" ON "d"."id" = "ud"."idDetail"
			WHERE "uq"."idUser" = :userId AND "uq"."state" IN ('N','P','L','C')
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
				idQuestUser: qid,
				header: {
					idQuestHeader: r.header_id,
						title: r.header_title,
						description: r.header_description,
						welcomeMessage: (typeof r.header_welcome_message !== 'undefined') ? r.header_welcome_message : null,
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
						idQuestUserDetail: r.user_detail_id,
						idDetail: r.detail_id,
						description: r.detail_description || (templateFromMap ? templateFromMap.description : null),
						needParam: (typeof r.detail_needParam !== 'undefined' && r.detail_needParam !== null) ? coerceBool(r.detail_needParam) : (templateFromMap ? coerceBool(templateFromMap.needParam) : false),
						paramType: (typeof r.detail_paramType !== 'undefined' && r.detail_paramType !== null) ? r.detail_paramType : (templateFromMap && typeof templateFromMap.paramType !== 'undefined' && templateFromMap.paramType !== null ? templateFromMap.paramType : 'string'),
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
		const uq = await QuestsUser.findAll({ where: { idUser: userId, state: { [Op.in]: ['N','P','L','C'] } }, include: [{ model: QuestsHeader }] });
		for (const q of uq) {
				map.set(qid, {
				idQuestUser: q.id,
				header: q.QuestsHeader ? {
					idQuestHeader: q.QuestsHeader.id,
					title: q.QuestsHeader.title,
					description: q.QuestsHeader.description,
					welcomeMessage: typeof q.QuestsHeader.welcomeMessage !== 'undefined' ? q.QuestsHeader.welcomeMessage : null,
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

// Activate a quest for a user
// - Verifies the QuestsUser exists and is in state 'N'
// - Sets state -> 'L', dateRead = now, dateExpiration = now + duration (minutes)
// - Returns the formatted quest object (same shape as getUserQuests returns for each quest)
async function activateQuest(userId, questUserId) {
	logger.info('[QuestService] activateQuest start', { userId, questUserId });

	const qu = await QuestsUser.findOne({ where: { id: questUserId, idUser: userId } });
	if (!qu) {
		logger.warn('[QuestService] activateQuest - quest user not found', { userId, questUserId });
		return null;
	}

	if (qu.state !== 'N') {
		const err = new Error('Quest must be in state N to activate');
		err.name = 'InvalidQuestState';
		logger.warn('[QuestService] activateQuest - invalid state', { userId, questUserId, state: qu.state });
		throw err;
	}

	// fetch header to read duration and possibly period
	const header = await QuestsHeader.findByPk(qu.idQuest);
	const now = new Date();
	let dateExpiration = null;
	try {
		const duration = header && typeof header.duration !== 'undefined' ? Number(header.duration) : 0;
		// duration is interpreted in minutes
		dateExpiration = duration > 0 ? new Date(now.getTime() + duration * 60000) : null;
	} catch (e) {
		dateExpiration = null;
	}

	qu.state = 'L';
	qu.dateRead = now;
	qu.dateExpiration = dateExpiration;
	await qu.save();

	// Reuse getUserQuests formatting and return the single quest
	const quests = await getUserQuests(userId);
	const qid = Number(questUserId);
	const found = quests.find(q => Number(q.idQuestUser) === qid);
	logger.info('[QuestService] activateQuest completed', { userId, questUserId, found: !!found });
	return found || null;
}

// Save multiple parameter values for a user's quest.
// values: [{ idDetail, value }]
async function saveQuestParams(userId, idQuest, values) {
	if (!Array.isArray(values) || values.length === 0) {
		logger.warn('[QuestService] saveQuestParams called with empty values', { userId, idQuest, values });
		return { success: false, message: 'values must be a non-empty array' };
	}

	const t = await db.sequelize.transaction();
	logger.info('[QuestService] saveQuestParams transaction started', { userId, idQuest });
	const failures = [];
	const updated = [];
	try {
		// lock the QuestsUser row for this user/quest to avoid races
		let qu = await QuestsUser.findOne({ where: { idUser: userId, idQuest }, transaction: t, lock: t.LOCK.UPDATE });
		if (!qu) {
			// It's possible the frontend sent the quests_users.id (questUserId) in `idQuest`.
			// Try treating the provided idQuest as the PK of the quests_users row.
			const quByPk = await QuestsUser.findByPk(idQuest, { transaction: t, lock: t.LOCK.UPDATE });
			if (quByPk) {
				logger.info('[QuestService] saveQuestParams - treating provided idQuest as quests_users.id', { providedIdQuest: idQuest, questUserId: quByPk.id, idUser: quByPk.idUser, idQuestTemplate: quByPk.idQuest });
				// If the quests_users row belongs to a different user, override the provided userId (log it)
				if (String(quByPk.idUser) !== String(userId)) {
					logger.warn('[QuestService] saveQuestParams - provided userId differs from quests_users.row, overriding userId', { providedUserId: userId, actualUserId: quByPk.idUser });
					userId = quByPk.idUser;
				}
				// Use the found quests_users row and make idQuest refer to the template id from that row
				qu = quByPk;
				idQuest = quByPk.idQuest;
			}
		}

		if (!qu) {
			logger.warn('[QuestService] saveQuestParams - QuestsUser not found', { userId, idQuest });
			await t.rollback();
			return { success: false, message: 'QuestsUser row not found' };
		}
		logger.info('[QuestService] saveQuestParams - locked QuestsUser', { questUserId: qu.id, userId, idQuest, state: qu.state });
		for (const v of values) {
			// Determine what the caller sent. We accept either:
			// - { idDetail, value } where idDetail is the template id (quests_details.id)
			// - { idQuestUserDetail, value } where idQuestUserDetail is the PK of quests_users_detail
			// - nested shapes where value is an object containing the above
			let idDetail = null;
			let rawValue = null;
			// item might be the wrapped object from frontend
			if (v && v.value && typeof v.value === 'object' && (typeof v.value.idDetail !== 'undefined' || typeof v.value.idQuestUserDetail !== 'undefined')) {
				// e.g. { value: { idQuestUserDetail: 30, value: 15 } }
				if (typeof v.value.idDetail !== 'undefined') idDetail = v.value.idDetail;
				if (typeof v.value.idQuestUserDetail !== 'undefined') v._idQuestUserDetail = v.value.idQuestUserDetail; // stash for later
				rawValue = typeof v.value.value !== 'undefined' ? v.value.value : null;
			} else {
				// flat shape: { idDetail, value } or { id: ..., value: ... }
				idDetail = v && (v.idDetail || v.id) ? (v.idDetail || v.id) : null;
				rawValue = typeof v.value !== 'undefined' ? v.value : null;
				// also support explicit idQuestUserDetail at top-level
				if (!idDetail && v && (v.idQuestUserDetail || v.idQuestUserDetail === 0)) v._idQuestUserDetail = v.idQuestUserDetail;
			}

			logger.debug('[QuestService] saveQuestParams - value item normalized', { item: v, idDetail, rawValue, idQuestUserDetail: v._idQuestUserDetail });

			// If caller provided the quests_users_detail PK (idQuestUserDetail), load that row first
			let userDetail = null;
			if (v && v._idQuestUserDetail) {
				userDetail = await QuestsUserDetail.findByPk(v._idQuestUserDetail, { transaction: t, lock: t.LOCK.UPDATE });
				if (!userDetail) {
					failures.push({ idDetail: v._idQuestUserDetail, message: 'user detail row not found (by PK)' });
					continue;
				}
				// get the template id from the user detail row
				idDetail = userDetail.idDetail;
			}

			if (!idDetail) {
				failures.push({ idDetail: null, message: 'idDetail missing' });
				continue;
			}

			const template = await QuestsDetail.findByPk(idDetail, { transaction: t });
			if (!template) {
				failures.push({ idDetail, message: 'detail template not found' });
				continue;
			}

			const paramType = (typeof template.paramType !== 'undefined' && template.paramType !== null) ? template.paramType : 'string';
			logger.debug('[QuestService] saveQuestParams - template paramType', { idDetail, paramType });

			let storeVal = null;
			if (paramType === 'number') {
				const n = Number(rawValue);
				if (Number.isNaN(n)) {
					failures.push({ idDetail, message: 'value must be a number' });
					continue;
				}
				// store normalized number as string in TEXT column
				storeVal = String(n);
			} else {
				// accept anything, store as string
				storeVal = rawValue === null || typeof rawValue === 'undefined' ? null : String(rawValue);
			}

			// If we didn't already load the userDetail by PK above, find the user's detail row by (idUser, idQuest, idDetail)
			if (!userDetail) {
				userDetail = await QuestsUserDetail.findOne({ where: { idUser: userId, idQuest: idQuest, idDetail: idDetail }, transaction: t, lock: t.LOCK.UPDATE });
				if (!userDetail) {
					failures.push({ idDetail, message: 'user detail row not found' });
					continue;
				}
			}

			userDetail.value = storeVal;
			await userDetail.save({ transaction: t });
			updated.push({ idDetail, value: storeVal, idQuestUserDetail: userDetail.id });
			logger.info('[QuestService] saveQuestParams - saved QuestsUserDetail', { idDetail, id: userDetail.id, idUser: userDetail.idUser, idQuest: userDetail.idQuest });
		}

		if (failures.length > 0) {
			logger.warn('[QuestService] saveQuestParams - failures detected, rolling back', { failures });
			await t.rollback();
			return { success: false, message: 'validation errors', details: failures };
		}

				// All params saved OK: mark the QuestsUser state to 'N' (no longer pending params)
				try {
					logger.info('[QuestService] saveQuestParams - updating QuestsUser state to N', { questUserId: qu.id, previousState: qu.state });
					qu.state = 'N';
					await qu.save({ transaction: t });
				} catch (e) {
					// if we can't update the quest user state, rollback
					await t.rollback();
					throw e;
				}

				await t.commit();

				// Reuse getUserQuests to return the formatted quest object to the caller
				const quests = await getUserQuests(userId);
				// find the quest whose header id matches idQuest OR whose quest_user id matches qu.id
				const found = quests.find(q => (q.header && q.header.idQuestHeader === Number(idQuest)) || Number(q.idQuestUser) === Number(qu.id));

				// Return quests as an array for consistency with controllers
				return { success: true, updated, quests: found ? [found] : [] };
	} catch (err) {
		try { await t.rollback(); } catch (e) {}
		throw err;
	}
}

// Toggle the isChecked flag for a QuestsUserDetail row.
// Accepts either idQuestUserDetail (PK) or idQuest + idDetail combination along with userId.
async function setQuestUserDetailChecked(userId, { idQuestUserDetail = null, idQuest = null, idDetail = null, checked = false } = {}) {
	logger.info('[QuestService] setQuestUserDetailChecked start', { userId, idQuestUserDetail, idQuest, idDetail, checked });
	if (!userId) throw new Error('userId is required');

	// Use a transaction with row-level locks to avoid race conditions when multiple
	// requests try to toggle details or finalize the same quest concurrently.
	const t = await db.sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.SERIALIZABLE });
	try {
		let userDetail = null;
		if (idQuestUserDetail) {
			// lock the specific user detail row
			userDetail = await QuestsUserDetail.findByPk(idQuestUserDetail, { transaction: t, lock: t.LOCK.UPDATE });
			// ensure the detail belongs to the provided userId
			if (userDetail && String(userDetail.idUser) !== String(userId)) {
				logger.warn('[QuestService] setQuestUserDetailChecked - ownership mismatch', { requestedUserId: userId, actualUserId: userDetail.idUser, id: userDetail.id });
				await t.rollback();
				return null;
			}
		} else if (idQuest && idDetail) {
			// lock the matching detail row for this user/quest/detail
			userDetail = await QuestsUserDetail.findOne({ where: { idUser: userId, idQuest: idQuest, idDetail: idDetail }, transaction: t, lock: t.LOCK.UPDATE });
		} else {
			logger.warn('[QuestService] setQuestUserDetailChecked - missing identifiers', { idQuestUserDetail, idQuest, idDetail });
			await t.rollback();
			return null;
		}

		if (!userDetail) {
			logger.warn('[QuestService] setQuestUserDetailChecked - QuestsUserDetail not found', { userId, idQuestUserDetail, idQuest, idDetail });
			await t.rollback();
			return null;
		}

		userDetail.isChecked = coerceBool(checked);
		userDetail.dateUpdated = new Date();
		await userDetail.save({ transaction: t });

		// After updating this detail, check if all details for this quest are now checked.
		// Lock all related detail rows to ensure a consistent snapshot.
		const details = await QuestsUserDetail.findAll({ where: { idUser: userId, idQuest: userDetail.idQuest }, transaction: t, lock: t.LOCK.UPDATE });
		const allChecked = details.length > 0 && details.every(d => d.isChecked === true);
		if (allChecked) {
			// lock the QuestsUser row before modifying
			const qu = await QuestsUser.findOne({ where: { idUser: userId, idQuest: userDetail.idQuest }, transaction: t, lock: t.LOCK.UPDATE });
			if (qu) {
				qu.state = 'C';
				qu.dateFinished = new Date();
				await qu.save({ transaction: t });
				logger.info('[QuestService] setQuestUserDetailChecked - marked quest as C (completed)', { userId, questUserId: qu.id, questId: qu.idQuest });
			}
		}

		await t.commit();
		logger.info('[QuestService] setQuestUserDetailChecked completed', { id: userDetail.id, isChecked: userDetail.isChecked });
		return userDetail;
	} catch (e) {
		try { await t.rollback(); } catch (er) { logger.error('[QuestService] setQuestUserDetailChecked - rollback failed', { error: er && er.message ? er.message : er }); }
		logger.error('[QuestService] setQuestUserDetailChecked - error', { error: e && e.message ? e.message : e });
		throw e;
	}
}

module.exports = {
	assignQuestToUser,
	createQuestUser,
	updateQuestStates,
	processQuestCompletion,
	getActiveQuestsForUser,
	getUserQuests,
	activateQuest,
	saveQuestParams,
	setQuestUserDetailChecked
};
