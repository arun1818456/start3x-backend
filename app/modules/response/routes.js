import express from 'express';
import {
    createResponse,
    getResponses,
    updateResponse,
    deleteResponse,
} from './controller.js';

const router = express.Router();

router.post('/create', createResponse);
router.get('/get', getResponses);
router.put('/update/:id', updateResponse);
router.delete('/delete/:id', deleteResponse);

export default router;
