import express from 'express';
import { RegisterUser, loginUser } from './controller.js';

const router = express.Router();

router.post('/create', RegisterUser);
router.post('/login', loginUser);

export default router;
