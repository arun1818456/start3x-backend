import express from 'express';
import { optionalAuth } from '../../middleWare/authWare.js';
import { getInsights, getInsightLeads } from './controller.js';

const router = express.Router();

router.get('/get', optionalAuth, getInsights);
router.get('/get-leads', optionalAuth, getInsightLeads);

export default router;
