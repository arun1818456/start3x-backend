import express from 'express';
import { optionalAuth } from '../../middleWare/authWare.js';
import {
    createResponse,
    getResponses,
    updateResponse,
    deleteResponse,
} from './controller.js';

const router = express.Router();

router.post('/create', optionalAuth, createResponse);
router.get('/get', optionalAuth, getResponses);
router.put('/update/:id', optionalAuth, updateResponse);
router.delete('/delete/:id', optionalAuth, deleteResponse);

export default router;
