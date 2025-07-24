/**
 * @file blogRoutes.ts
 * @description This file defines the API routes for blog posts, including public routes for fetching posts
 * and admin-only routes for creating, updating, and deleting posts, as well as uploading images.
 * It integrates with `blogController` for business logic, `authMiddleware` for authentication and authorization,
 * and `uploadService` for file uploads.
 *
 * @dependencies
 * - express: The Express framework for creating router instances.
 * - path: Node.js module for handling file paths.
 * - ../middleware/authMiddleware: Middleware for authentication and authorization.
 * - @prisma/client: Prisma client types for roles.
 * - ../controllers/blogController: Controllers for blog post logic.
 * - ../services/uploadService: Service for handling file uploads.
 *
 * @exports
 * - router: The Express router instance for blog routes.
 */
import { Router } from "express";
import _path from "path";
import { authenticate, authorize } from "../middleware/authMiddleware";
import { Role } from "@prisma/client";
import {
  getAllBlogPosts,
  getBlogPostBySlug,
  getBlogPostById,
  createBlogPost,
  updateBlogPost,
  deleteBlogPost,
} from "../controllers/blogController";
import { upload, getFileUrl } from "../services/uploadService";

const router = Router();

// Public routes - no authentication required
router.get("/", getAllBlogPosts);
router.get("/:slug", getBlogPostBySlug);

// File upload route (admin only)
router.post(
  "/upload",
  authenticate,
  authorize(Role.ADMIN),
  upload.single("image"),
  (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const fileUrl = getFileUrl((req.file as unknown).key);
      res.json({
        url: fileUrl,
        filename: (req.file as unknown).key,
        originalName: req.file.originalname,
        size: req.file.size,
        mimeType: req.file.mimetype,
      });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ error: "Failed to upload file" });
    }
  },
);

// Admin-only routes
router.get("/admin/:id", authenticate, authorize(Role.ADMIN), getBlogPostById);
router.post("/", authenticate, authorize(Role.ADMIN), createBlogPost);
router.put("/:id", authenticate, authorize(Role.ADMIN), updateBlogPost);
router.delete("/:id", authenticate, authorize(Role.ADMIN), deleteBlogPost);

export default router;
