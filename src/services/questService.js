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

// Create a QuestsUser entry and corresponding QuestsUserDetail rows
async function createQuestUser(userId, questHeader, transaction = null) {
	logger.debug('[QuestService] createQuestUser', userId, questHeader && questHeader.id);
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

		if (!tProvided) await t.commit();
		return created;
	} catch (err) {
		if (!tProvided) await t.rollback();
		throw err;
	}
}

// Assign any missing quests for the user based on level and active flag
async function assignQuestToUser(userId) {
	logger.info('[QuestService] assignQuestToUser for', userId);
	const user = await User.findByPk(userId);
	if (!user) throw new Error('Usuario no encontrado');

	const candidates = await QuestsHeader.findAll({
		where: {
			active: true,
			levelRequired: { [Op.lte]: user.level }
		}
	});

	const created = [];
	for (const q of candidates) {
		// Use a transaction per-creation to avoid races
		const t = await db.sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.SERIALIZABLE });
		try {
			const exists = await QuestsUser.findOne({ where: { idUser: userId, idQuest: q.id }, transaction: t, lock: t.LOCK.UPDATE });
			if (!exists) {
				const cu = await createQuestUser(userId, q, t);
				created.push(cu.toJSON ? cu.toJSON() : cu);
			} else {
				await t.commit();
			}
		} catch (err) {
			try { await t.rollback(); } catch (e) {}
			logger.error('[QuestService] assignQuestToUser error for quest', q.id, err && err.message ? err.message : err);
		}
	}
	return created;
}

// Process completion or expiration rewards for a given QuestsUser record
async function processQuestCompletion(userId, questUser) {
	logger.info('[QuestService] processQuestCompletion for user', userId, 'quest', questUser.idQuest);
	const rewards = [];
	const t = await db.sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.SERIALIZABLE });
	try {
		// reload questUser with lock to avoid concurrent processing
		const qu = await QuestsUser.findOne({ where: { id: questUser.id }, transaction: t, lock: t.LOCK.UPDATE });
		if (!qu) throw new Error('QuestsUser record no encontrado');
		// If already finalized, skip
		if (qu.state === 'F' && qu.finished) {
			await t.commit();
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
	logger.info('[QuestService] updateQuestStates for', userId);
	const results = [];
	const now = new Date();

	const questUsers = await QuestsUser.findAll({ where: { idUser: userId, state: { [Op.in]: ['C', 'E', 'L'] } } });
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
					results.push(res);
				}
			}
		} catch (err) {
			logger.error('[QuestService] Error processing questUser', qu.id, err && err.message ? err.message : err);
		}
	}

	return results;
}

// Return active quests for a user with details
async function getActiveQuestsForUser(userId) {
	logger.debug('[QuestService] getActiveQuestsForUser', userId);
	const active = [];
	const quests = await QuestsUser.findAll({ where: { idUser: userId, state: { [Op.in]: ['N', 'P', 'L'] } } });
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

module.exports = {
	assignQuestToUser,
	createQuestUser,
	updateQuestStates,
	processQuestCompletion,
	getActiveQuestsForUser
};
