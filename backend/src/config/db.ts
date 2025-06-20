import { PrismaClient } from '@prisma/client';

// This is the single, shared instance of PrismaClient
const prisma = new PrismaClient();

export default prisma; 