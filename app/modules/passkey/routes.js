import express from 'express';
import auth from "../../middleWare/authWare.js";
import { generatePasskey, listPasskeys, verifyPasskey, deletePasskey } from './controller.js';

const router = express.Router();

router.post('/generate', auth, generatePasskey);
router.get('/list', listPasskeys);
router.post('/verify', verifyPasskey);
router.delete('/delete/:id', deletePasskey);

export default router;
