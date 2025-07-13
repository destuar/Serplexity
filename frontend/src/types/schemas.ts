import { z } from 'zod';

export const CompetitorSchema = z.object({
  id: z.string(),
  name: z.string(),
  website: z.string().nullable().optional(),
  companyId: z.string(),
  isGenerated: z.boolean().optional().default(false),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const BenchmarkingQuestionSchema = z.object({
  id: z.string(),
  text: z.string(),
  companyId: z.string(),
  isGenerated: z.boolean().optional().default(false),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const ProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  companyId: z.string(),
  isGenerated: z.boolean().optional().default(false),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const CompanySchema = z.object({
  id: z.string(),
  name: z.string(),
  website: z.string().nullable(),
  industry: z.string().nullable(),
  userId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  competitors: z.array(CompetitorSchema).optional().default([]),
  benchmarkingQuestions: z.array(BenchmarkingQuestionSchema).optional().default([]),
  products: z.array(ProductSchema).optional().default([]),
});

export const UserSchema = z.object({
    id: z.string(),
    name: z.string(),
    email: z.string(),
    provider: z.string(),
    subscriptionStatus: z.string().optional(),
    role: z.string().optional(),
    companies: z.array(CompanySchema).optional(),
});

export enum Role {
  USER = 'USER',
  ADMIN = 'ADMIN'
}

export type User = z.infer<typeof UserSchema>;
export type Company = z.infer<typeof CompanySchema>;
export type Competitor = z.infer<typeof CompetitorSchema>;
export type BenchmarkingQuestion = z.infer<typeof BenchmarkingQuestionSchema>;
export type Product = z.infer<typeof ProductSchema>; 