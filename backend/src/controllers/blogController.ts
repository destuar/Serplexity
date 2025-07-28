/**
 * @file blogController.ts
 * @description This file contains the controllers for managing blog posts, including CRUD (Create, Read, Update, Delete) operations.
 * It handles features like automatic slug generation, reading time calculation, and authorization to ensure that only admins
 * can access unpublished content. It also provides endpoints for fetching single and multiple blog posts.
 *
 * @dependencies
 * - express: The Express framework for handling HTTP requests and responses.
 * - @prisma/client: The Prisma client for database interactions.
 * - zod: For schema validation of request bodies.
 * - ../config/db: The singleton Prisma client instance.
 *
 * @exports
 * - getAllBlogPosts: Controller for fetching all blog posts.
 * - getBlogPostBySlug: Controller for fetching a single blog post by its slug.
 * - getBlogPostById: Controller for fetching a single blog post by its ID (admin only).
 * - createBlogPost: Controller for creating a new blog post.
 * - updateBlogPost: Controller for updating an existing blog post.
 * - deleteBlogPost: Controller for deleting a blog post.
 */
import { Request, Response } from "express";
import { z } from "zod";
import { getDbClient } from "../config/database";

const createBlogPostSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  excerpt: z.string().optional(),
  coverImage: z
    .string()
    .refine(
      (val) => {
        // Allow uploaded images (relative paths starting with /api/blog/uploads/)
        if (val.startsWith("/api/blog/uploads/")) {
          return true;
        }
        // For external images, validate as URL
        try {
          new URL(val);
          return true;
        } catch {
          return false;
        }
      },
      {
        message: "Must be a valid URL or uploaded image path",
      }
    )
    .optional(),
  metaTitle: z.string().max(60).optional(),
  metaDescription: z.string().max(160).optional(),
  tags: z.array(z.string()).default([]),
  published: z.boolean().default(false),
});

const updateBlogPostSchema = createBlogPostSchema.partial();

const generateSlug = (title: string): string => {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
};

const ensureUniqueSlug = async (
  baseSlug: string,
  excludeId?: string
): Promise<string> => {
  const prisma = await getDbClient();
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await prisma.blogPost.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!existing || (excludeId && existing.id === excludeId)) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter++;
  }
};

// Calculate reading time based on content
const calculateReadingTime = (content: string): number => {
  // Strip HTML tags and count words
  const text = content.replace(/<[^>]*>/g, "");
  const wordCount = text.split(/\s+/).filter((word) => word.length > 0).length;
  // Average reading speed is 200 words per minute
  return Math.ceil(wordCount / 200);
};

export const getAllBlogPosts = async (req: Request, res: Response) => {
  const prisma = await getDbClient();
  try {
    const { published } = req.query;
    const isAdmin = req.user?.role === "ADMIN";

    const where =
      published !== undefined
        ? { published: published === "true" }
        : isAdmin
          ? {}
          : { published: true };

    const posts = await prisma.blogPost.findMany({
      where,
      include: {
        author: {
          select: { id: true, name: true, email: true },
        },
        media: true,
        _count: {
          select: { media: true },
        },
      },
      orderBy: [
        { published: "desc" },
        { publishedAt: "desc" },
        { createdAt: "desc" },
      ],
    });

    res.json(posts);
  } catch (error) {
    console.error("Error fetching blog posts:", error);
    res.status(500).json({ error: "Failed to fetch blog posts" });
  }
};

export const getBlogPostBySlug = async (req: Request, res: Response) => {
  const prisma = await getDbClient();
  try {
    const { slug } = req.params;
    const isAdmin = req.user?.role === "ADMIN";

    const post = await prisma.blogPost.findUnique({
      where: { slug },
      include: {
        author: {
          select: { id: true, name: true, email: true },
        },
        media: true,
      },
    });

    if (!post) {
      return res.status(404).json({ error: "Blog post not found" });
    }

    if (!post.published && !isAdmin) {
      return res.status(404).json({ error: "Blog post not found" });
    }

    res.json(post);
  } catch (error) {
    console.error("Error fetching blog post:", error);
    res.status(500).json({ error: "Failed to fetch blog post" });
  }
};

export const getBlogPostById = async (req: Request, res: Response) => {
  const prisma = await getDbClient();
  try {
    const { id } = req.params;
    const isAdmin = req.user?.role === "ADMIN";

    if (!isAdmin) {
      return res.status(403).json({ error: "Access denied" });
    }

    const post = await prisma.blogPost.findUnique({
      where: { id },
      include: {
        author: {
          select: { id: true, name: true, email: true },
        },
        media: true,
      },
    });

    if (!post) {
      return res.status(404).json({ error: "Blog post not found" });
    }

    res.json(post);
  } catch (error) {
    console.error("Error fetching blog post by ID:", error);
    res.status(500).json({ error: "Failed to fetch blog post" });
  }
};

export const createBlogPost = async (req: Request, res: Response) => {
  const prisma = await getDbClient();
  try {
    const validatedData = createBlogPostSchema.parse(req.body);
    const userId = req.user!.id;

    const baseSlug = generateSlug(validatedData.title);
    const slug = await ensureUniqueSlug(baseSlug);
    const estimatedReadTime = calculateReadingTime(validatedData.content);

    const post = await prisma.blogPost.create({
      data: {
        ...validatedData,
        slug,
        authorId: userId,
        estimatedReadTime,
        publishedAt: validatedData.published ? new Date() : null,
      },
      include: {
        author: {
          select: { id: true, name: true, email: true },
        },
        media: true,
      },
    });

    res.status(201).json(post);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ error: "Validation failed", details: error.errors });
    }
    console.error("Error creating blog post:", error);
    res.status(500).json({ error: "Failed to create blog post" });
  }
};

export const updateBlogPost = async (req: Request, res: Response) => {
  const prisma = await getDbClient();
  try {
    const { id } = req.params;
    const validatedData = updateBlogPostSchema.parse(req.body);

    const existingPost = await prisma.blogPost.findUnique({
      where: { id },
      select: { id: true, slug: true, published: true, title: true },
    });

    if (!existingPost) {
      return res.status(404).json({ error: "Blog post not found" });
    }

    let slug = existingPost.slug;
    if (validatedData.title && validatedData.title !== existingPost.title) {
      const baseSlug = generateSlug(validatedData.title);
      slug = await ensureUniqueSlug(baseSlug, id);
    }

    const wasUnpublished = !existingPost.published;
    const willBePublished = validatedData.published === true;

    // Recalculate reading time if content changed
    const estimatedReadTime = validatedData.content
      ? calculateReadingTime(validatedData.content)
      : undefined;

    const post = await prisma.blogPost.update({
      where: { id },
      data: {
        ...validatedData,
        slug,
        estimatedReadTime,
        publishedAt: wasUnpublished && willBePublished ? new Date() : undefined,
      },
      include: {
        author: {
          select: { id: true, name: true, email: true },
        },
        media: true,
      },
    });

    res.json(post);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({ error: "Validation failed", details: error.errors });
    }
    console.error("Error updating blog post:", error);
    res.status(500).json({ error: "Failed to update blog post" });
  }
};

export const deleteBlogPost = async (req: Request, res: Response) => {
  const prisma = await getDbClient();
  try {
    const { id } = req.params;

    const existingPost = await prisma.blogPost.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existingPost) {
      return res.status(404).json({ error: "Blog post not found" });
    }

    await prisma.blogPost.delete({
      where: { id },
    });

    res.status(204).send();
  } catch (error) {
    console.error("Error deleting blog post:", error);
    res.status(500).json({ error: "Failed to delete blog post" });
  }
};
