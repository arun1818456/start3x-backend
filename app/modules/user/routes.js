import express from 'express';
import auth from "../../middleWare/authWare.js";
import { RegisterUser, loginUser, getUserDetails, getAllClientsInfo } from './controller.js';

const router = express.Router();

router.post('/create', RegisterUser);
router.post('/login', loginUser);

router.get('/details', auth, getUserDetails);
router.get('/clients-info', auth, getAllClientsInfo);

export default router;
