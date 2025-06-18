import { Router, Request, Response } from 'express';

const router = Router();

// Mock data based on the outline
const mockMetrics = [
    { date: '2024-07-20', query_id: 1, engine: 'Google SGE', pawc: 0.75, air: 1, first_citation_idx: 0 },
    { date: '2024-07-20', query_id: 2, engine: 'Google SGE', pawc: 0.50, air: 1, first_citation_idx: 1 },
    { date: '2024-07-20', query_id: 3, engine: 'Perplexity', pawc: 0.90, air: 1, first_citation_idx: 0 },
    { date: '2024-07-20', query_id: 4, engine: 'Bing Copilot', pawc: 0.00, air: 0, first_citation_idx: null },
    { date: '2024-07-21', query_id: 1, engine: 'Google SGE', pawc: 0.78, air: 1, first_citation_idx: 0 },
    { date: '2024-07-21', query_id: 2, engine: 'Google SGE', pawc: 0.52, air: 1, first_citation_idx: 1 },
    { date: '2024-07-21', query_id: 3, engine: 'Perplexity', pawc: 0.88, air: 1, first_citation_idx: 0 },
    { date: '2024-07-21', query_id: 4, engine: 'Bing Copilot', pawc: 0.01, air: 0, first_citation_idx: null },
];

router.get('/', (req: Request, res: Response) => {
    res.json(mockMetrics);
});

export default router; 