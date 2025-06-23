import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware';
import {
  createCompany,
  getCompanies,
  getCompany,
  updateCompany,
  deleteCompany,
  generateCompetitorsFromAI,
  getAverageInclusionRate,
  getAveragePosition,
  getShareOfVoice,
  getShareOfVoiceHistory,
  getSentimentData,
  getTopRankingQuestions,
  getCompetitorRankings,
  getSentimentOverTime,
} from '../controllers/companyController';

const router = Router();

// All company routes require authentication
router.use(authenticate);

// Company CRUD routes
router.post('/', createCompany);           // POST /api/companies - Create new company
router.get('/', getCompanies);             // GET /api/companies - Get all user's companies
router.get('/:id', getCompany);            // GET /api/companies/:id - Get specific company
router.put('/:id', updateCompany);         // PUT /api/companies/:id - Update company
router.delete('/:id', deleteCompany);      // DELETE /api/companies/:id - Delete company

// Metrics
router.get('/:id/metrics/air', getAverageInclusionRate); // GET /api/companies/:id/metrics/air
router.get('/:id/metrics/position', getAveragePosition); // GET /api/companies/:id/metrics/position
router.get('/:id/metrics/share-of-voice', getShareOfVoice); // GET /api/companies/:id/metrics/share-of-voice
router.get('/:id/metrics/share-of-voice/history', getShareOfVoiceHistory); // GET /api/companies/:id/metrics/share-of-voice/history
router.get('/:id/metrics/competitor-rankings', getCompetitorRankings);
router.get('/:id/metrics/sentiment', getSentimentData); // GET /api/companies/:id/metrics/sentiment
router.get('/:id/top-ranking-questions', getTopRankingQuestions); // GET /api/companies/:id/top-ranking-questions
router.get('/:id/metrics/sentiment-over-time', getSentimentOverTime);

// AI-powered features
router.post('/:id/generate-competitors', generateCompetitorsFromAI); // POST /api/companies/:id/generate-competitors

export default router; 