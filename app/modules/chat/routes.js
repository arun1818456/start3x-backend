import express from 'express';
import {
    sendChatMessage,
    getChatMessages,
    deleteChatMessage,
} from './controller.js';

const router = express.Router();

router.post('/send', sendChatMessage);
router.get('/get', getChatMessages);
router.delete('/delete/:id', deleteChatMessage);

export default router;
