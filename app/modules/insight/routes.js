import express from 'express';
import { getInsights, getInsightLeads } from './controller.js';

const router = express.Router();

router.get('/get', getInsights);
router.get('/get-leads', getInsightLeads);

export default router;
