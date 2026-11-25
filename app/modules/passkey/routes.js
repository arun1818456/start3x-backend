import express from 'express';
import auth, { optionalAuth } from "../../middleWare/authWare.js";
import { generatePasskey, listPasskeys, togglePasskeyStatus, updateClientInfo, getPasskeyUsers, getPasskeyDetails } from './controller.js';

const router = express.Router();

router.post('/generate', auth, generatePasskey);
router.get('/list', optionalAuth, listPasskeys);
router.get('/details/:passkey', optionalAuth, getPasskeyDetails);
router.get('/details', optionalAuth, getPasskeyDetails);
router.get('/users/:passkey', optionalAuth, getPasskeyUsers);
router.put('/toggle/:id', optionalAuth, togglePasskeyStatus);
router.put('/update-client-info', auth, updateClientInfo);

export default router;
