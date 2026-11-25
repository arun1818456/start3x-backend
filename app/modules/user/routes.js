import express from 'express';
import auth from "../../middleWare/authWare.js";
import { RegisterUser, loginUser, logoutUser, getUserDetails, getAllClientsInfo, googleLoginUser, updateDeviceToken } from './controller.js';

const router = express.Router();

router.post('/create', RegisterUser);
router.post('/login', loginUser);
router.post('/logout', auth, logoutUser);
router.post('/google', googleLoginUser);
router.put('/update-device-token', auth, updateDeviceToken);

router.get('/details', auth, getUserDetails);
router.get('/clients-info', auth, getAllClientsInfo);

export default router;
