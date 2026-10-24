import express from 'express';
import auth from "../../middleWare/authWare.js";
import { createLead, getLeads, updateLead, deleteLead } from './controller.js';

const router = express.Router();

router.post('/create', createLead);
router.get('/get', getLeads);
router.put('/update/:id', updateLead);
router.delete('/delete/:id', deleteLead);

export default router;
