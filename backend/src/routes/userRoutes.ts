import { Router } from 'express';
import { exportUserData, deleteUserData, getUserProfile, updateUserProfile, changePassword } from '../controllers/userController';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();

// Profile routes
router.get('/me/profile', authenticate, getUserProfile);
router.put('/me/profile', authenticate, updateUserProfile);
router.put('/me/password', authenticate, changePassword);

// Data management routes
router.get('/me/export', authenticate, exportUserData);
router.delete('/me/delete', authenticate, deleteUserData);

export default router; 