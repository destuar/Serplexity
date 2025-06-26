import { Router } from 'express';
import { askModel } from '../controllers/searchController';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();

// POST /api/search – generate answer for a single model
router.post('/', authenticate, askModel);

export default router; 