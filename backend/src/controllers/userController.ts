import { Request, Response } from 'express';
import prisma from '../config/db';

export const exportUserData = async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        const userData = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                provider: true,
                tokenVersion: true,
                stripeCustomerId: true,
                subscriptionStatus: true,
                createdAt: true,
                updatedAt: true,
                companies: {
                    include: {
                        competitors: true,
                        runs: {
                            include: {
                                questions: true,
                                answers: true,
                                metrics: true
                            }
                        }
                    }
                }
            }
        });

        if (!userData) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.setHeader('Content-disposition', 'attachment; filename=user-data.json');
        res.setHeader('Content-type', 'application/json');
        res.status(200).json(userData);

    } catch (error) {
        console.error(`[EXPORT USER DATA ERROR] for userId: ${userId}`, error);
        res.status(500).json({ error: 'Failed to export user data' });
    }
};

export const deleteUserData = async (req: Request, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        await prisma.$transaction(async (tx) => {
            const userCompanies = await tx.company.findMany({
                where: { userId: userId },
                select: { id: true }
            });
            const companyIds = userCompanies.map(c => c.id);

            // Explicitly delete all data related to the user in the correct order
            await tx.metric.deleteMany({ where: { reportRun: { companyId: { in: companyIds } } } });
            await tx.answer.deleteMany({ where: { reportRun: { companyId: { in: companyIds } } } });
            await tx.question.deleteMany({ where: { reportRun: { companyId: { in: companyIds } } } });
            await tx.reportRun.deleteMany({ where: { companyId: { in: companyIds } } });
            await tx.competitor.deleteMany({ where: { companyId: { in: companyIds } } });
            await tx.company.deleteMany({ where: { userId: userId } });
            
            // Finally, delete the user
            await tx.user.delete({
                where: { id: userId }
            });
        });

        // Placeholder for async S3 cleanup job
        console.log(`User ${userId} deleted. A real implementation would trigger an async cleanup for any related assets in S3.`);
        // await s3CleanupQueue.add('cleanup-user-assets', { userId });

        res.status(200).json({ message: 'User data has been deleted.' });
    } catch (error) {
        console.error(`[DELETE USER DATA ERROR] for userId: ${userId}`, error);
        res.status(500).json({ error: 'Failed to delete user data' });
    }
};

export const getUserProfile = async (req: Request, res: Response) => {
  try {
    // ... existing code ...
  } catch (error) {
    // ... existing code ...
  }
}; 