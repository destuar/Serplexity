import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware';
import {
  createCompany,
  getCompanies,
  getCompany,
  updateCompany,
  deleteCompany,
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

export default router; 