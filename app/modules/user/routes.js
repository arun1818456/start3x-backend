import express from 'express';
import auth from "../../middleWare/authWare.js";
import { RegisterUser, loginUser, getUserDetails } from './controller.js';

const router = express.Router();

router.post('/create', RegisterUser);
router.post('/login', loginUser);
router.get('/details', auth, getUserDetails);

export default router;
