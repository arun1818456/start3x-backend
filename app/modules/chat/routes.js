import express from 'express';
import { optionalAuth } from '../../middleWare/authWare.js';
import {
    sendChatMessage,
    getChatMessages,
    deleteChatMessage,
    deleteMultipleChatMessages,
} from './controller.js';

const router = express.Router();

router.post('/send', optionalAuth, sendChatMessage);
router.get('/get', optionalAuth, getChatMessages);
router.delete('/delete/:id', optionalAuth, deleteChatMessage);
router.post('/delete-multiple', optionalAuth, deleteMultipleChatMessages);

export default router;
