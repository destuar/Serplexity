import { Router } from 'express';
import { exportUserData, deleteUserData } from '../controllers/userController';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();

router.get('/me/export', authenticate, exportUserData);
router.delete('/me/delete', authenticate, deleteUserData);

export default router; 