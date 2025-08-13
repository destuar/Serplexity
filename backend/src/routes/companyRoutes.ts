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
import {
  acceptCompetitor,
  addCompetitor,
  addQuestion,
  createCompany,
  declineCompetitor,
  deleteCompany,
  deleteCompetitor,
  deleteQuestion,
  getAcceptedCompetitors,
  getAveragePosition,
  getCitations,
  getCompanies,
  getCompany,
  getCompanyModelPreferences,
  getCompanyQuestions,
  getCompanyReadiness,
  getCompanyReportSchedule,
  getCompetitorRankings,
  getInclusionRateHistory,
  getPromptsWithResponses,
  getSentimentData,
  getSentimentOverTime,
  getShareOfVoice,
  getShareOfVoiceHistory,
  getSuggestedCompetitors,
  getTopRankingQuestions,
  updateCompany,
  updateCompanyModelPreferences,
  updateCompanyReportSchedule,
  updateCompetitor,
  updateQuestion,
} from "../controllers/companyController";
import { authenticate } from "../middleware/authMiddleware";
// freemium/trial removed
import { enforceCompanyCap } from "../middleware/quotaGuard";

const router = Router();

// All company routes require authentication
router.use(authenticate);

// Company CRUD routes
router.post("/", enforceCompanyCap, createCompany); // POST /api/companies - Create new company
router.get("/", getCompanies); // GET /api/companies - Get all user's companies
router.get("/:id", getCompany); // GET /api/companies/:id - Get specific company
router.get("/:id/readiness", getCompanyReadiness); // GET /api/companies/:id/readiness - Check if questions are ready
router.put("/:id", updateCompany); // PUT /api/companies/:id - Update company
router.delete("/:id", deleteCompany); // DELETE /api/companies/:id - Delete company

// Company-scoped model preferences
router.get("/:id/model-preferences", getCompanyModelPreferences);
router.put("/:id/model-preferences", updateCompanyModelPreferences);

// Company report schedule management
router.get("/:id/report-schedule", getCompanyReportSchedule);
router.put("/:id/report-schedule", updateCompanyReportSchedule);

// Metrics
router.get("/:id/metrics/position", getAveragePosition); // GET /api/companies/:id/metrics/position
router.get("/:id/metrics/share-of-voice", getShareOfVoice); // GET /api/companies/:id/metrics/share-of-voice
router.get("/:id/metrics/competitor-rankings", getCompetitorRankings);
router.get("/:id/metrics/sentiment", getSentimentData); // GET /api/companies/:id/metrics/sentiment
router.get("/:id/top-ranking-questions", getTopRankingQuestions); // GET /api/companies/:id/top-ranking-questions
router.get(
  "/:id/prompts-with-responses",
  authenticate,
  getPromptsWithResponses
); // GET /api/companies/:id/prompts-with-responses - View only for free users
router.get("/:id/metrics/sentiment-over-time", getSentimentOverTime);
router.get("/:id/share-of-voice-history", getShareOfVoiceHistory);
router.get("/:id/inclusion-rate-history", getInclusionRateHistory);

// Competitor management routes
router.get("/:id/competitors/accepted", getAcceptedCompetitors); // GET /api/companies/:id/competitors/accepted
router.get("/:id/citations", getCitations); // GET /api/companies/:id/citations
router.get("/:id/competitors/suggested", getSuggestedCompetitors); // GET /api/companies/:id/competitors/suggested
router.post("/:id/competitors/:competitorId/accept", acceptCompetitor); // POST /api/companies/:id/competitors/:competitorId/accept
router.post("/:id/competitors/:competitorId/decline", declineCompetitor); // POST /api/companies/:id/competitors/:competitorId/decline
router.post("/:id/competitors", addCompetitor); // POST /api/companies/:id/competitors
router.put("/:id/competitors/:competitorId", updateCompetitor); // PUT /api/companies/:id/competitors/:competitorId
router.delete("/:id/competitors/:competitorId", deleteCompetitor); // DELETE /api/companies/:id/competitors/:competitorId

// Question management routes
router.get("/:id/questions", authenticate, getCompanyQuestions); // View questions - free
router.post("/:id/questions", authenticate, addQuestion); // Add questions - subscription only
router.put("/:id/questions/:questionId", authenticate, updateQuestion); // Edit questions - subscription only
router.delete("/:id/questions/:questionId", authenticate, deleteQuestion); // Delete questions - subscription only

export default router;
