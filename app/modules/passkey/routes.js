import express from 'express';
import auth from "../../middleWare/authWare.js";
import { generatePasskey, listPasskeys, togglePasskeyStatus } from './controller.js';

const router = express.Router();

router.post('/generate', auth, generatePasskey);
router.get('/list', listPasskeys);
router.put('/toggle/:id', togglePasskeyStatus);

export default router;
