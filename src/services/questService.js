const db = require('../config/database');
const { Op } = require('sequelize');
const logger = require('../utils/logger');
const periodUtils = require('../utils/periodUtils');

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

function isSerializationError(err) {
	if (!err) return false;
	const code = (err.original && err.original.code) || err.code;
	if (code && String(code) === '40001') return true;
	const message = (err.original && err.original.message) || err.message || String(err);
	return typeof message === 'string' && message.includes('could not serialize access');
}

function delay(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
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
		}
		return created;
	} catch (err) {
		if (!tProvided) {
			await t.rollback();
			logger.error('[QuestService] Error creando quest user', { error: err && err.message ? err.message : err });
		}
		throw err;
	}
}

// Assign any missing quests for the user based on level and active flag
async function assignQuestToUser(userId) {
	const user = await User.findByPk(userId);
	if (!user) throw new Error('Usuario no encontrado');

    
	const candidates = await QuestsHeader.findAll({
		where: {
			active: true,
			levelRequired: { [Op.lte]: user.level }
		}
	});

	const created = [];
	const now = new Date();
	
	for (const q of candidates) {
		// Para misiones con periodicidad personalizada (WEEKDAYS/PATTERN), verificar si hoy es día válido
		const periodType = (q.periodType || 'FIXED').toUpperCase();
		if (periodType === 'WEEKDAYS' || periodType === 'PATTERN') {
			const isTodayValid = periodUtils.shouldBeActiveOnDate(q, now);
			if (!isTodayValid) {
				// Si hoy NO es un día válido, no asignar la misión todavía
				logger.debug(`Misión "${q.title}" no asignada - hoy no es día válido (periodType: ${periodType})`);
				continue;
			}
		}
		
		let attempt = 0;
		const maxAttempts = 3;
		while (attempt < maxAttempts) {
			attempt += 1;
			const t = await db.sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.SERIALIZABLE });
			try {
				const exists = await QuestsUser.findOne({ where: { idUser: userId, idQuest: q.id }, transaction: t, lock: t.LOCK.UPDATE });
				if (!exists) {
					const cu = await createQuestUser(userId, q, t);
					created.push(cu.toJSON ? cu.toJSON() : cu);
					await t.commit();
					logger.info(`Misión "${q.title}" asignada a usuario ${user.username}`);
				} else {
					await t.commit();
				}
				break;
			} catch (err) {
				try { await t.rollback(); } catch (e) {}
				if (isSerializationError(err) && attempt < maxAttempts) {
					const backoff = 50 * Math.pow(2, attempt - 1);
					await delay(backoff);
					continue;
				}
				logger.error('[QuestService] Error asignando quest', { error: err && err.message ? err.message : err });
				break;
			}
		}
	}
	return created;
}

// Process completion or expiration rewards for a given QuestsUser record
async function processQuestCompletion(userId, questUser, transaction = null) {
	const rewards = [];
	const externalTx = !!transaction;
	const t = transaction || await db.sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.SERIALIZABLE });
	try {
		const qu = await QuestsUser.findOne({ where: { id: questUser.id }, transaction: t, lock: t.LOCK.UPDATE });
		if (!qu) throw new Error('QuestsUser record no encontrado');
		
		if (qu.rewardDelivered) {
			if (!externalTx) await t.commit();
			return { idQuest: qu.idQuest, state: qu.state, objects: [] };
		}
		
		if (qu.state === 'F' && qu.finished) {
			if (!externalTx) await t.commit();
			return { idQuest: qu.idQuest, state: qu.state, objects: [] };
		}

		try {
			const rewardResult = await processQuestRewards(qu, t);
			if (rewardResult && rewardResult.applied) {
				rewards.push(...rewardResult.applied);
			}
		} catch (prErr) {
			logger.error('[QuestService] Error procesando recompensas', { error: prErr && prErr.message ? prErr.message : prErr });
			throw prErr;
		}

		try {
			const resultChar = (qu.state === 'C') ? 'C' : (qu.state === 'E' ? 'E' : null);
			if (resultChar && QuestsUserLog) {
				await createQuestUserLog(userId, qu.idQuest, resultChar, rewards, t);
			}
		} catch (logErr) {
			logger.error('[QuestService] Error creando log', { error: logErr && logErr.message ? logErr.message : logErr });
			throw logErr;
		}

		try {
			const header = await QuestsHeader.findByPk(qu.idQuest, { transaction: t });
			const period = header && header.period ? String(header.period).toUpperCase() : 'U';
			
			if (!header.active) {
				qu.state = 'F';
				qu.finished = true;
				qu.dateFinished = new Date();
				await qu.save({ transaction: t });
			} else if (period !== 'U') {
				const nextExp = periodUtils.computeNextExpiration(header, new Date());
				qu.finished = true;
				qu.dateFinished = new Date();
				qu.dateExpiration = nextExp;
				await qu.save({ transaction: t });
			} else {
				qu.state = 'F';
				qu.finished = true;
				qu.dateFinished = new Date();
				await qu.save({ transaction: t });
			}
		} catch (reschedErr) {
			logger.error('[QuestService] Error finalizando quest', { error: reschedErr && reschedErr.message ? reschedErr.message : reschedErr });
			throw reschedErr;
		}

		if (!externalTx) await t.commit();
		return { idQuest: qu.idQuest, state: qu.state, objects: rewards };
	} catch (err) {
		logger.error('[QuestService] Error en processQuestCompletion', { error: err && err.message ? err.message : err });
		if (!externalTx) {
			try { await t.rollback(); } catch (e) { logger.error('[QuestService] Rollback failed', { error: e && e.message ? e.message : e }); }
		}
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
	const results = [];
	const now = new Date();

	const questUsers = await QuestsUser.findAll({ where: { idUser: userId, state: { [Op.in]: ['C', 'E', 'L', 'F'] } } });
	
	for (const qu of questUsers) {
		try {
            
			if ((qu.state === 'C' || qu.state === 'E') && !qu.rewardDelivered) {
				const res = await processQuestCompletion(userId, qu);
				results.push(res);
				continue;
			}

			if (qu.state === 'C' && qu.rewardDelivered && qu.finished) {
				try {
					const header = await QuestsHeader.findByPk(qu.idQuest);
					const period = header && header.period ? String(header.period).toUpperCase() : 'U';
					
					if (!header.active) {
						qu.state = 'F';
						qu.finished = true;
						await qu.save();
						continue;
					}
					
					if (period !== 'U') {
						if (qu.dateExpiration && new Date(qu.dateExpiration) <= now) {
							const isTodayValid = periodUtils.shouldBeActiveOnDate(header, now);
							
							if (!isTodayValid) {
								const nextExp = periodUtils.computeNextExpiration(header, now);
								qu.dateExpiration = nextExp;
								await qu.save();
								continue;
							}
							
							const nextExp = periodUtils.computeNextExpiration(header, now);
							try {
								await QuestsUserDetail.update({ isChecked: false, dateUpdated: new Date() }, { where: { idUser: qu.idUser, idQuest: qu.idQuest } });
							} catch (e) {
								logger.debug('[QuestService] updateQuestStates - detail reset failed', { error: e && e.message ? e.message : e });
							}
							qu.state = 'L';
							qu.finished = false;
							qu.rewardDelivered = false;
							qu.dateFinished = null;
							qu.dateRead = new Date();
							qu.dateExpiration = nextExp;
							await qu.save();
							results.push({ idQuest: qu.idQuest, state: 'L', rescheduled: true, nextExpiration: nextExp });
						}
					}
				} catch (e) {
					logger.error('[QuestService] Error reactivando quest C', { error: e && e.message ? e.message : e });
				}
				continue;
			}

			if (qu.state === 'E' && qu.rewardDelivered && qu.finished) {
				try {
					const header = await QuestsHeader.findByPk(qu.idQuest);
					const period = header && header.period ? String(header.period).toUpperCase() : 'U';
					
					if (!header.active) {
						qu.state = 'F';
						qu.finished = true;
						await qu.save();
						continue;
					}
					
					if (period !== 'U') {
						if (qu.dateExpiration && new Date(qu.dateExpiration) <= now) {
							const isTodayValid = periodUtils.shouldBeActiveOnDate(header, now);
							
							if (!isTodayValid) {
								const nextExp = periodUtils.computeNextExpiration(header, now);
								qu.dateExpiration = nextExp;
								await qu.save();
								continue;
							}
							
							const nextExp = periodUtils.computeNextExpiration(header, now);
							try {
								await QuestsUserDetail.update({ isChecked: false, dateUpdated: new Date() }, { where: { idUser: qu.idUser, idQuest: qu.idQuest } });
							} catch (e) {
								logger.debug('[QuestService] updateQuestStates - detail reset failed', { error: e && e.message ? e.message : e });
							}
							qu.state = 'L';
							qu.finished = false;
							qu.rewardDelivered = false;
							qu.dateFinished = null;
							qu.dateRead = new Date();
							qu.dateExpiration = nextExp;
							await qu.save();
							results.push({ idQuest: qu.idQuest, state: 'L', rescheduled: true, nextExpiration: nextExp });
						}
					}
			} catch (e) {
				logger.error('[QuestService] Error reactivando quest E', { error: e && e.message ? e.message : e });
			}
			continue;
		}			if (qu.state === 'F') {
				try {
					const header = await QuestsHeader.findByPk(qu.idQuest);
					
					if (!header.active) {
						continue;
					}
					
					const period = header && header.period ? String(header.period).toUpperCase() : 'U';
					if (period !== 'U') {
						if (qu.dateExpiration && new Date(qu.dateExpiration) <= now) {
							const isTodayValid = periodUtils.shouldBeActiveOnDate(header, now);
							
							if (!isTodayValid) {
								const nextExp = periodUtils.computeNextExpiration(header, now);
								qu.dateExpiration = nextExp;
								await qu.save();
								continue;
							}
							
							const nextExp = periodUtils.computeNextExpiration(header, now);
							try {
								await QuestsUserDetail.update({ isChecked: false, dateUpdated: new Date() }, { where: { idUser: qu.idUser, idQuest: qu.idQuest } });
							} catch (e) {
								logger.debug('[QuestService] updateQuestStates - detail reset failed', { error: e && e.message ? e.message : e });
							}
							qu.state = 'L';
							qu.finished = false;
							qu.rewardDelivered = false;
							qu.dateFinished = null;
							qu.dateRead = new Date();
							qu.dateExpiration = nextExp;
							await qu.save();
							results.push({ idQuest: qu.idQuest, state: 'L', rescheduled: true, nextExpiration: nextExp });
						}
					}
				} catch (e) {
					logger.error('[QuestService] Error reactivando quest F', { error: e && e.message ? e.message : e });
				}
				continue;
			}

			if (qu.state === 'L') {
				if (qu.dateExpiration && new Date(qu.dateExpiration) < now) {
					qu.state = 'E';
					await qu.save();
					const res = await processQuestCompletion(userId, qu);
					results.push(res);
					continue;
				}

				const details = await QuestsUserDetail.findAll({ where: { idUser: userId, idQuest: qu.idQuest } });
				const allChecked = details.length > 0 && details.every(d => d.isChecked === true);
				if (allChecked) {
					qu.state = 'C';
					await qu.save();
					const res = await processQuestCompletion(userId, qu);
					logger.info(`Usuario completa misión ID ${qu.idQuest}`);
					results.push(res);
				}
			}
		} catch (err) {
			logger.error('[QuestService] Error procesando quest', { error: err && err.message ? err.message : err });
		}
	}

	return results;
}

// Return active quests for a user with details
async function getActiveQuestsForUser(userId) {
    
	const active = [];
	const quests = await QuestsUser.findAll({ where: { idUser: userId, state: { [Op.in]: ['N', 'P', 'L'] } } });
	
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
		const templates = await QuestsDetail.findAll({ where: { id: ids } });
		for (const t of templates) {
			templateMap[t.id] = t; // store model instance
		}
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
			const qid = Number(q.id);
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
	return result;
}

// Activate a quest for a user
// - Verifies the QuestsUser exists and is in state 'N'
// - Sets state -> 'L', dateRead = now, dateExpiration calculated based on periodicity
// - All quests expire at 03:00 of the next valid day (no personalized duration margin)
// - Returns the formatted quest object (same shape as getUserQuests returns for each quest)
async function activateQuest(userId, questUserId) {
	const qu = await QuestsUser.findOne({ where: { id: questUserId, idUser: userId } });
	if (!qu) {
		return null;
	}

	if (qu.state !== 'N') {
		const err = new Error('Quest must be in state N to activate');
		err.name = 'InvalidQuestState';
		throw err;
	}

	const header = await QuestsHeader.findByPk(qu.idQuest);
	const now = new Date();
	let dateExpiration = null;
	
	try {
		dateExpiration = periodUtils.computeFirstActivationExpiration(header, now);
		logger.info(`Usuario acepta misión "${header.title}"`);
	} catch (e) {
		dateExpiration = new Date(now);
		dateExpiration.setHours(3, 0, 0, 0);
		if (now >= dateExpiration) {
			dateExpiration.setDate(dateExpiration.getDate() + 1);
		}
	}

	qu.state = 'L';
	qu.dateRead = now;
	qu.dateExpiration = dateExpiration;
	await qu.save();

	const quests = await getUserQuests(userId);
	const qid = Number(questUserId);
	const found = quests.find(q => Number(q.idQuestUser) === qid);
	return found || null;
}

async function saveQuestParams(userId, idQuest, values) {
	if (!Array.isArray(values) || values.length === 0) {
		return { success: false, message: 'values must be a non-empty array' };
	}

	const t = await db.sequelize.transaction();
	const failures = [];
	const updated = [];
	try {
		// lock the QuestsUser row for this user/quest to avoid races
		let qu = await QuestsUser.findOne({ where: { idUser: userId, idQuest }, transaction: t, lock: t.LOCK.UPDATE });
		if (!qu) {
			const quByPk = await QuestsUser.findByPk(idQuest, { transaction: t, lock: t.LOCK.UPDATE });
			if (quByPk) {
				if (String(quByPk.idUser) !== String(userId)) {
					userId = quByPk.idUser;
				}
				qu = quByPk;
				idQuest = quByPk.idQuest;
			}
		}

		if (!qu) {
			await t.rollback();
			return { success: false, message: 'QuestsUser row not found' };
		}
		
		for (const v of values) {
			let idDetail = null;
			let rawValue = null;
			
			if (v && v.value && typeof v.value === 'object' && (typeof v.value.idDetail !== 'undefined' || typeof v.value.idQuestUserDetail !== 'undefined')) {
				if (typeof v.value.idDetail !== 'undefined') idDetail = v.value.idDetail;
				if (typeof v.value.idQuestUserDetail !== 'undefined') v._idQuestUserDetail = v.value.idQuestUserDetail;
				rawValue = typeof v.value.value !== 'undefined' ? v.value.value : null;
			} else {
				idDetail = v && (v.idDetail || v.id) ? (v.idDetail || v.id) : null;
				rawValue = typeof v.value !== 'undefined' ? v.value : null;
				if (!idDetail && v && (v.idQuestUserDetail || v.idQuestUserDetail === 0)) v._idQuestUserDetail = v.idQuestUserDetail;
			}

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
		}

		if (failures.length > 0) {
			await t.rollback();
			return { success: false, message: 'validation errors', details: failures };
		}

			// All params saved OK: mark the QuestsUser state to 'N' (no longer pending params)
			try {
				qu.state = 'N';
				await qu.save({ transaction: t });
			} catch (e) {
				// if we can't update the quest user state, rollback
					await t.rollback();
					throw e;
				}

				await t.commit();

				let activatedQuest = null;
				try {
					activatedQuest = await activateQuest(userId, qu.id);
				} catch (activationErr) {
					logger.error('[QuestService] Error auto activating quest', {
						questUserId: qu.id,
						error: activationErr && activationErr.message ? activationErr.message : activationErr
					});
					throw activationErr;
				}

				return { success: true, updated, quests: activatedQuest ? [activatedQuest] : [] };
	} catch (err) {
		try { await t.rollback(); } catch (e) {}
		throw err;
	}
}

// Toggle the isChecked flag for a QuestsUserDetail row.
// Accepts either idQuestUserDetail (PK) or idQuest + idDetail combination along with userId.
async function setQuestUserDetailChecked(userId, { idQuestUserDetail = null, idQuest = null, idDetail = null, checked = false } = {}) {
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
				await t.rollback();
				return null;
			}
		} else if (idQuest && idDetail) {
			// lock the matching detail row for this user/quest/detail
			userDetail = await QuestsUserDetail.findOne({ where: { idUser: userId, idQuest: idQuest, idDetail: idDetail }, transaction: t, lock: t.LOCK.UPDATE });
		} else {
			await t.rollback();
			return null;
		}

		if (!userDetail) {
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

				// Procesar recompensas INMEDIATAMENTE cuando se completa la quest
				if (!qu.rewardDelivered) {
					try {
						// Pasar la transacción existente para que todo sea atómico
						await processQuestCompletion(userId, qu, t);
						logger.info(`[QuestService] Recompensas procesadas inmediatamente para quest ${qu.idQuest}`);
					} catch (rewardErr) {
						logger.error('[QuestService] Error procesando recompensas inmediatas', { 
							error: rewardErr && rewardErr.message ? rewardErr.message : rewardErr 
						});
						// Re-lanzar el error para revertir toda la transacción
						throw rewardErr;
					}
				}
			}
		}

		await t.commit();
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
