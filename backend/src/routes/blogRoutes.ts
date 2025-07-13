import { Router } from 'express';
import path from 'path';
import { authenticate, authorize } from '../middleware/authMiddleware';
import { Role } from '@prisma/client';
import {
  getAllBlogPosts,
  getBlogPostBySlug,
  createBlogPost,
  updateBlogPost,
  deleteBlogPost
} from '../controllers/blogController';
import { upload, getFileUrl } from '../services/uploadService';

const router = Router();

// Public routes - no authentication required
router.get('/', getAllBlogPosts);
router.get('/:slug', getBlogPostBySlug);

// File upload route (admin only)
router.post('/upload', authenticate, authorize(Role.ADMIN), upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileUrl = getFileUrl(req.file.filename);
    res.json({ 
      url: fileUrl,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      mimeType: req.file.mimetype
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// Serve uploaded files (public)
router.get('/uploads/:filename', (req, res) => {
  const filename = req.params.filename;
  const filepath = path.join(process.cwd(), 'uploads/blog', filename);
  res.sendFile(filepath);
});

// Admin-only routes
router.post('/', authenticate, authorize(Role.ADMIN), createBlogPost);
router.put('/:id', authenticate, authorize(Role.ADMIN), updateBlogPost);
router.delete('/:id', authenticate, authorize(Role.ADMIN), deleteBlogPost);

export default router;