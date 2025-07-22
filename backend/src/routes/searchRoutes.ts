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
import { Router } from "express";
import { askModel } from "../controllers/searchController";
import { searchWithAgent, searchAgentHealth } from "../controllers/searchAgentController";
import { authenticate } from "../middleware/authMiddleware";

const router = Router();

// POST /api/search – generate answer for a single model (legacy)
router.post("/", authenticate, askModel);

// POST /api/search/agent – generate search response with optimized agent
router.post("/agent", authenticate, searchWithAgent);

// GET /api/search/agent/health – health check for search agent
router.get("/agent/health", searchAgentHealth);

export default router;
