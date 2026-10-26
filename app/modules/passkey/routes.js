import express from 'express';
import auth from "../../middleWare/authWare.js";
import { generatePasskey, listPasskeys, togglePasskeyStatus , updateClientInfo} from './controller.js';

const router = express.Router();

router.post('/generate', auth, generatePasskey);
router.get('/list', listPasskeys);
router.put('/toggle/:id', togglePasskeyStatus);
router.put('/update-client-info', auth, updateClientInfo);

export default router;
