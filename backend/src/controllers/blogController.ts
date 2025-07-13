import { Request, Response } from 'express';
import { Role } from '@prisma/client';
import prisma from '../config/db';
import { z } from 'zod';

const createBlogPostSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  excerpt: z.string().optional(),
  coverImage: z.string().url().optional(),
  published: z.boolean().default(false),
});

const updateBlogPostSchema = createBlogPostSchema.partial();

const generateSlug = (title: string): string => {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
};

const ensureUniqueSlug = async (baseSlug: string, excludeId?: string): Promise<string> => {
  let slug = baseSlug;
  let counter = 1;
  
  while (true) {
    const existing = await prisma.blogPost.findUnique({
      where: { slug },
      select: { id: true }
    });
    
    if (!existing || (excludeId && existing.id === excludeId)) {
      return slug;
    }
    
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
};

export const getAllBlogPosts = async (req: Request, res: Response) => {
  try {
    const { published } = req.query;
    const isAdmin = req.user?.role === Role.ADMIN;
    
    const where = published !== undefined 
      ? { published: published === 'true' }
      : isAdmin ? {} : { published: true };

    const posts = await prisma.blogPost.findMany({
      where,
      include: {
        author: {
          select: { id: true, name: true, email: true }
        },
        media: true,
        _count: {
          select: { media: true }
        }
      },
      orderBy: [
        { published: 'desc' },
        { publishedAt: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    res.json(posts);
  } catch (error) {
    console.error('Error fetching blog posts:', error);
    res.status(500).json({ error: 'Failed to fetch blog posts' });
  }
};

export const getBlogPostBySlug = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const isAdmin = req.user?.role === Role.ADMIN;

    const post = await prisma.blogPost.findUnique({
      where: { slug },
      include: {
        author: {
          select: { id: true, name: true, email: true }
        },
        media: true
      }
    });

    if (!post) {
      return res.status(404).json({ error: 'Blog post not found' });
    }

    if (!post.published && !isAdmin) {
      return res.status(404).json({ error: 'Blog post not found' });
    }

    res.json(post);
  } catch (error) {
    console.error('Error fetching blog post:', error);
    res.status(500).json({ error: 'Failed to fetch blog post' });
  }
};

export const createBlogPost = async (req: Request, res: Response) => {
  try {
    const validatedData = createBlogPostSchema.parse(req.body);
    const userId = req.user!.id;

    const baseSlug = generateSlug(validatedData.title);
    const slug = await ensureUniqueSlug(baseSlug);

    const post = await prisma.blogPost.create({
      data: {
        ...validatedData,
        slug,
        authorId: userId,
        publishedAt: validatedData.published ? new Date() : null
      },
      include: {
        author: {
          select: { id: true, name: true, email: true }
        },
        media: true
      }
    });

    res.status(201).json(post);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Error creating blog post:', error);
    res.status(500).json({ error: 'Failed to create blog post' });
  }
};

export const updateBlogPost = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validatedData = updateBlogPostSchema.parse(req.body);

    const existingPost = await prisma.blogPost.findUnique({
      where: { id },
      select: { id: true, slug: true, published: true, title: true }
    });

    if (!existingPost) {
      return res.status(404).json({ error: 'Blog post not found' });
    }

    let slug = existingPost.slug;
    if (validatedData.title && validatedData.title !== existingPost.title) {
      const baseSlug = generateSlug(validatedData.title);
      slug = await ensureUniqueSlug(baseSlug, id);
    }

    const wasUnpublished = !existingPost.published;
    const willBePublished = validatedData.published === true;

    const post = await prisma.blogPost.update({
      where: { id },
      data: {
        ...validatedData,
        slug,
        publishedAt: wasUnpublished && willBePublished ? new Date() : undefined
      },
      include: {
        author: {
          select: { id: true, name: true, email: true }
        },
        media: true
      }
    });

    res.json(post);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('Error updating blog post:', error);
    res.status(500).json({ error: 'Failed to update blog post' });
  }
};

export const deleteBlogPost = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const existingPost = await prisma.blogPost.findUnique({
      where: { id },
      select: { id: true }
    });

    if (!existingPost) {
      return res.status(404).json({ error: 'Blog post not found' });
    }

    await prisma.blogPost.delete({
      where: { id }
    });

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting blog post:', error);
    res.status(500).json({ error: 'Failed to delete blog post' });
  }
};