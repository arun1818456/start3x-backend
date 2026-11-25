import express from 'express';
import { optionalAuth } from "../../middleWare/authWare.js";
import { createLead, getLeads, updateLead, deleteLead, notifyWebEnquiry } from './controller.js';

const router = express.Router();

router.post('/create', optionalAuth, createLead);
router.post('/web-enquiry', notifyWebEnquiry);
router.get('/get', optionalAuth, getLeads);
router.put('/update/:id', optionalAuth, updateLead);
router.delete('/delete/:id', optionalAuth, deleteLead);

export default router;
