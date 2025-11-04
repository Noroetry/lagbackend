const messageService = require('../services/messageService');
const logger = require('../utils/logger');

async function sendMessage(req, res) {
    try {
    logger.info('[MessageController] Enviando mensaje');
        const source = req.user?.username || req.userId && req.userId.username; // prefer req.user
        if (!source) return res.status(401).json({ error: 'No autorizado' });

        const { title, description, destination, adjunts } = req.body;
        const msg = await messageService.createMessage({ title, description, destination, adjunts }, source);
        return res.status(201).json({ message: 'Mensaje enviado', data: msg });
    } catch (error) {
        logger.error('[MessageController] Error enviando mensaje:', error.message || error);
        return res.status(error.status || 400).json({ error: error.message });
    }
}

async function inbox(req, res) {
    try {
        logger.info('[MessageController] Obteniendo bandeja de entrada');
        const username = req.user?.username || req.userId;
        if (!username) return res.status(401).json({ error: 'No autorizado' });
        const unreadOnly = req.query.unread === 'true';
        const messages = await messageService.getInbox(username, { unreadOnly });
        return res.status(200).json(messages);
    } catch (error) {
        logger.error('[MessageController] Error inbox:', error.message || error);
        return res.status(500).json({ error: 'Fallo recuperando bandeja' });
    }
}

async function sent(req, res) {
    try {
        logger.info('[MessageController] Obteniendo mensajes enviados');
        const username = req.user?.username || req.userId;
        if (!username) return res.status(401).json({ error: 'No autorizado' });
        const messages = await messageService.getSent(username);
        return res.status(200).json(messages);
    } catch (error) {
        logger.error('[MessageController] Error sent:', error.message || error);
        return res.status(500).json({ error: 'Fallo recuperando enviados' });
    }
}

async function getMessage(req, res) {
    try {
        const id = req.params.id;
        const username = req.user?.username || req.userId;
        if (!username) return res.status(401).json({ error: 'No autorizado' });
        const msg = await messageService.getMessageById(id, username);
        return res.status(200).json(msg);
    } catch (error) {
        logger.error('[MessageController] Error getMessage:', error.message || error);
        return res.status(error.status || 500).json({ error: error.message });
    }
}

async function markRead(req, res) {
    try {
        const id = req.params.id;
        const username = req.user?.username || req.userId;
        const msg = await messageService.markRead(id, username);
        return res.status(200).json(msg);
    } catch (error) {
        logger.error('[MessageController] Error markRead:', error.message || error);
        return res.status(error.status || 500).json({ error: error.message });
    }
}

async function changeState(req, res) {
    try {
        const id = req.params.id;
        const { state } = req.body;
        const username = req.user?.username || req.userId;
        const msg = await messageService.changeState(id, username, state);
        return res.status(200).json(msg);
    } catch (error) {
        logger.error('[MessageController] Error changeState:', error.message || error);
        return res.status(error.status || 500).json({ error: error.message });
    }
}

module.exports = {
    sendMessage,
    inbox,
    sent,
    getMessage,
    markRead,
    changeState
};
