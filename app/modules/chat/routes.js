import express from 'express';
import { optionalAuth } from '../../middleWare/authWare.js';
import {
    sendChatMessage,
    getChatMessages,
    deleteChatMessage,
} from './controller.js';

const router = express.Router();

router.post('/send', optionalAuth, sendChatMessage);
router.get('/get', optionalAuth, getChatMessages);
router.delete('/delete/:id', optionalAuth, deleteChatMessage);

export default router;
