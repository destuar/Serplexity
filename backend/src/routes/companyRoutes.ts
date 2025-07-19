/**
 * @file companyRoutes.ts
 * @description This file defines the API routes for company management and related metrics.
 * It includes standard CRUD (Create, Read, Update, Delete) operations for companies, as well as endpoints for fetching
 * various performance metrics like average inclusion rate, average position, share of voice, and competitor rankings.
 * All routes are protected by authentication middleware.
 *
 * @dependencies
 * - express: The Express framework for creating router instances.
 * - ../middleware/authMiddleware: Middleware for authentication.
 * - ../controllers/companyController: Controllers for company-related business logic.
 *
 * @exports
 * - router: The Express router instance for company routes.
 */
import { Router } from "express";
import { authenticate } from "../middleware/authMiddleware";
import {
  createCompany,
  deleteCompany,
  getAverageInclusionRate,
  getAveragePosition,
  getCompanies,
  getCompany,
  getCompetitorRankings,
  getSentimentData,
  getSentimentOverTime,
  getShareOfVoice,
  getShareOfVoiceHistory,
  getTopRankingQuestions,
  updateCompany,
} from "../controllers/companyController";

const router = Router();

// All company routes require authentication
router.use(authenticate);

// Company CRUD routes
router.post("/", createCompany); // POST /api/companies - Create new company
router.get("/", getCompanies); // GET /api/companies - Get all user's companies
router.get("/:id", getCompany); // GET /api/companies/:id - Get specific company
router.put("/:id", updateCompany); // PUT /api/companies/:id - Update company
router.delete("/:id", deleteCompany); // DELETE /api/companies/:id - Delete company

// Metrics
router.get("/:id/metrics/air", getAverageInclusionRate); // GET /api/companies/:id/metrics/air
router.get("/:id/metrics/position", getAveragePosition); // GET /api/companies/:id/metrics/position
router.get("/:id/metrics/share-of-voice", getShareOfVoice); // GET /api/companies/:id/metrics/share-of-voice
router.get("/:id/metrics/competitor-rankings", getCompetitorRankings);
router.get("/:id/metrics/sentiment", getSentimentData); // GET /api/companies/:id/metrics/sentiment
router.get("/:id/top-ranking-questions", getTopRankingQuestions); // GET /api/companies/:id/top-ranking-questions
router.get("/:id/metrics/sentiment-over-time", getSentimentOverTime);
router.get("/:id/share-of-voice-history", getShareOfVoiceHistory);

// AI-powered features (competitor generation removed - competitors are now discovered from responses)

export default router;
