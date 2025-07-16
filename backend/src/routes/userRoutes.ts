/**
 * @file userRoutes.ts
 * @description This file defines the API routes for user profile management and data operations.
 * It includes routes for fetching and updating user profiles, changing passwords, and exporting/deleting user data.
 * All routes are protected by authentication middleware.
 *
 * @dependencies
 * - express: The Express framework for creating router instances.
 * - ../controllers/userController: Controllers for user-related business logic.
 * - ../middleware/authMiddleware: Middleware for authentication.
 *
 * @exports
 * - router: The Express router instance for user routes.
 */
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