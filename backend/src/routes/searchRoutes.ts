/**
 * @file searchRoutes.ts
 * @description This file defines the API routes for search-related operations, specifically for asking questions to a language model.
 * It integrates with `searchController` for business logic and `authMiddleware` for authentication.
 *
 * @dependencies
 * - express: The Express framework for creating router instances.
 * - ../controllers/searchController: Controllers for search-related business logic.
 * - ../middleware/authMiddleware: Middleware for authentication.
 *
 * @exports
 * - router: The Express router instance for search routes.
 */
import { Router } from 'express';
import { askModel } from '../controllers/searchController';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();

// POST /api/search – generate answer for a single model
router.post('/', authenticate, askModel);

export default router; 