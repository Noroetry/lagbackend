const db = require('../config/database');
const { Op } = require('sequelize');

const logger = require('../utils/logger');

const Message = db.Message;
const User = db.User;

async function createMessage({ title, description, adjunts, destination }, sourceUsername) {
    if (!title || !description || !destination) {
        throw new Error('title, description y destination son obligatorios');
    }

    // Verify destination exists
    const destUser = await User.findOne({ where: { username: destination } });
    if (!destUser) {
        const err = new Error(`Destination user ${destination} no existe`);
        err.status = 404;
        throw err;
    }

    const msg = await Message.create({
        title,
        description,
        source: sourceUsername,
        destination,
        adjunts: adjunts || null,
        // read default N, dateSent defaults to NOW, state default 'A'
    });

    logger.debug('Message created from', sourceUsername, 'to', destination);
    return msg.toJSON ? msg.toJSON() : msg;
}

async function getInbox(username, { unreadOnly = false } = {}) {
    const where = {
        destination: username,
        state: { [Op.ne]: 'D' } // exclude deleted
    };
    if (unreadOnly) {
        where.read = 'N';
    }
    const messages = await Message.findAll({ where, order: [['dateSent', 'DESC']] });
    return messages.map(m => (m.toJSON ? m.toJSON() : m));
}

async function getSent(username) {
    const messages = await Message.findAll({ where: { source: username, state: { [Op.ne]: 'D' } }, order: [['dateSent', 'DESC']] });
    return messages.map(m => (m.toJSON ? m.toJSON() : m));
}

async function getMessageById(id, username) {
    const message = await Message.findByPk(id);
    if (!message) throw new Error('Mensaje no encontrado');

    const m = message.toJSON ? message.toJSON() : message;
    if (m.source !== username && m.destination !== username) {
        const err = new Error('No autorizado para ver este mensaje');
        err.status = 403;
        throw err;
    }
    return m;
}

async function markRead(id, username) {
    const message = await Message.findByPk(id);
    if (!message) throw new Error('Mensaje no encontrado');
    if (message.destination !== username) {
        const err = new Error('Sólo el destinatario puede marcar como leído');
        err.status = 403;
        throw err;
    }
    message.read = 'S';
    message.dateRead = new Date();
    await message.save();
    logger.debug('Message marked read:', id, 'by', username);
    return message.toJSON ? message.toJSON() : message;
}

async function changeState(id, username, newState) {
    const allowed = ['A','D','R'];
    if (!allowed.includes(newState)) throw new Error('Estado inválido');

    const message = await Message.findByPk(id);
    if (!message) throw new Error('Mensaje no encontrado');
    // allow source or destination to change state
    if (message.source !== username && message.destination !== username) {
        const err = new Error('No autorizado para cambiar estado');
        err.status = 403;
        throw err;
    }

    message.state = newState;
    await message.save();
    logger.debug('Message state changed:', id, 'to', newState, 'by', username);
    return message.toJSON ? message.toJSON() : message;
}

module.exports = {
    createMessage,
    getInbox,
    getSent,
    getMessageById,
    markRead,
    changeState
};
