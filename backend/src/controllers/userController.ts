/**
 * @file userController.ts
 * @description This file contains the controllers for managing all user-related operations.
 * It handles everything from fetching and updating user profiles to changing passwords and managing user data,
 * including exporting and deleting it. This is a critical component for ensuring user privacy and control over their data.
 *
 * @dependencies
 * - express: The Express framework for handling HTTP requests and responses.
 * - zod: For schema validation of request bodies.
 * - bcrypt: For hashing and comparing passwords.
 * - ../config/db: The singleton Prisma client instance for database interactions.
 *
 * @exports
 * - exportUserData: Controller for exporting all of a user's data.
 * - deleteUserData: Controller for deleting all of a user's data.
 * - getUserProfile: Controller for fetching a user's profile.
 * - updateUserProfile: Controller for updating a user's profile.
 * - changePassword: Controller for changing a user's password.
 */
import { Request, Response } from "express";
import { z } from "zod";
import bcrypt from "bcrypt";
import { getDbClient } from "../config/database";

// Validation schemas
const updateProfileSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name too long")
    .optional(),
  email: z.string().email("Invalid email address").optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

export const exportUserData = async (req: Request, res: Response) => {
  const prisma = await getDbClient();
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Not authenticated" });
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
                sentimentScores: true,
              },
            },
          },
        },
      },
    });

    if (!userData) {
      return res.status(404).json({ error: "User not found" });
    }

    res.setHeader("Content-disposition", "attachment; filename=user-data.json");
    res.setHeader("Content-type", "application/json");
    res.status(200).json(userData);
  } catch (error) {
    console.error(`[EXPORT USER DATA ERROR] for userId: ${userId}`, error);
    res.status(500).json({ error: "Failed to export user data" });
  }
};

export const deleteUserData = async (req: Request, res: Response) => {
  const prisma = await getDbClient();
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    await prisma.$transaction(async (tx) => {
      const userCompanies = await tx.company.findMany({
        where: { userId: userId },
        select: { id: true },
      });
      const companyIds = userCompanies.map((c) => c.id);

      // Explicitly delete all data related to the user in the correct order
      await tx.sentimentScore.deleteMany({
        where: { reportRun: { companyId: { in: companyIds } } },
      });
      await tx.reportRun.deleteMany({
        where: { companyId: { in: companyIds } },
      });
      await tx.competitor.deleteMany({
        where: { companyId: { in: companyIds } },
      });
      await tx.question.deleteMany({
        where: { companyId: { in: companyIds } },
      });
      // Removed product deletion as Product model deprecated
      await tx.company.deleteMany({ where: { userId: userId } });

      // Finally, delete the user
      await tx.user.delete({
        where: { id: userId },
      });
    });

    // Placeholder for async S3 cleanup job
    console.log(
      `User ${userId} deleted. A real implementation would trigger an async cleanup for any related assets in S3.`,
    );
    // await s3CleanupQueue.add('cleanup-user-assets', { userId });

    res.status(200).json({ message: "User data has been deleted." });
  } catch (error) {
    console.error(`[DELETE USER DATA ERROR] for userId: ${userId}`, error);
    res.status(500).json({ error: "Failed to delete user data" });
  }
};

export const getUserProfile = async (req: Request, res: Response) => {
  const prisma = await getDbClient();
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        provider: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json({ user });
  } catch (error) {
    console.error("[GET USER PROFILE ERROR]", error);
    res.status(500).json({ error: "Failed to get user profile" });
  }
};

export const updateUserProfile = async (req: Request, res: Response) => {
  const prisma = await getDbClient();
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { name, email } = updateProfileSchema.parse(req.body);

    // Check if email is already taken by another user
    if (email) {
      const existingUser = await prisma.user.findFirst({
        where: {
          email,
          id: { not: userId },
        },
      });

      if (existingUser) {
        return res.status(400).json({ error: "Email already in use" });
      }
    }

    // Build update data object
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        provider: true,
        subscriptionStatus: true,
        stripeCustomerId: true,
        companies: { include: { competitors: true } },
      },
    });

    res.status(200).json({ user: updatedUser });
  } catch (error) {
    console.error("[UPDATE USER PROFILE ERROR]", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: "Failed to update user profile" });
  }
};

export const changePassword = async (req: Request, res: Response) => {
  const prisma = await getDbClient();
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { currentPassword, newPassword } = changePasswordSchema.parse(
      req.body,
    );

    // Get user with password
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, password: true, provider: true },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if user signed up with OAuth (no password)
    if (user.provider !== "credentials" || !user.password) {
      return res.status(400).json({
        error: "Cannot change password for OAuth accounts",
      });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(
      currentPassword,
      user.password,
    );
    if (!isValidPassword) {
      return res.status(400).json({ error: "Current password is incorrect" });
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Update password and increment token version to invalidate existing tokens
    await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedNewPassword,
        tokenVersion: { increment: 1 },
      },
    });

    res.status(200).json({ message: "Password changed successfully" });
  } catch (error) {
    console.error("[CHANGE PASSWORD ERROR]", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: "Failed to change password" });
  }
};

// Model preferences validation schema
const modelPreferencesSchema = z.object({
  modelPreferences: z.record(z.string(), z.boolean()),
});

export const getModelPreferences = async (req: Request, res: Response) => {
  const prisma = await getDbClient();
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { modelPreferences: true },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Return default preferences if none are set
    const preferences = (user.modelPreferences as Record<string, boolean>) || {
      "gpt-4.1-mini": true,
      "claude-3-5-haiku-20241022": true,
      "gemini-2.5-flash": true,
      sonar: true,
    };

    res.status(200).json({ modelPreferences: preferences });
  } catch (error) {
    console.error("[GET MODEL PREFERENCES ERROR]", error);
    res.status(500).json({ error: "Failed to get model preferences" });
  }
};

export const updateModelPreferences = async (req: Request, res: Response) => {
  const prisma = await getDbClient();
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { modelPreferences } = modelPreferencesSchema.parse(req.body);

    await prisma.user.update({
      where: { id: userId },
      data: { modelPreferences },
    });

    res.status(200).json({
      message: "Model preferences updated successfully",
      modelPreferences,
    });
  } catch (error) {
    console.error("[UPDATE MODEL PREFERENCES ERROR]", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: "Failed to update model preferences" });
  }
};

/**
 * Get user trial status and access permissions
 */
export const getTrialStatus = async (req: Request, res: Response) => {
  const prisma = await getDbClient();
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        subscriptionStatus: true,
        trialStartedAt: true,
        trialEndsAt: true,
        role: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Calculate trial status
    const now = new Date();
    const isAdmin = user.role === "ADMIN";
    const hasActiveSubscription = user.subscriptionStatus === "active";
    const isTrialing = user.subscriptionStatus === "trialing";
    const trialExpired = user.trialEndsAt ? now >= new Date(user.trialEndsAt) : true;
    const isInActiveTrial = isTrialing && !trialExpired;
    
    const daysRemaining = user.trialEndsAt ? 
      Math.max(0, Math.ceil((new Date(user.trialEndsAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))) 
      : 0;

    // Determine access levels
    const hasFullAccess = isAdmin || hasActiveSubscription || isInActiveTrial;
    const canModifyPrompts = hasFullAccess;
    const canCreateReports = true; // Always allowed during and after trial
    const maxActiveQuestions = hasFullAccess ? null : 5; // Unlimited for paid users, 5 for free

    res.status(200).json({
      subscriptionStatus: user.subscriptionStatus,
      isTrialing,
      trialExpired,
      trialStartedAt: user.trialStartedAt,
      trialEndsAt: user.trialEndsAt,
      daysRemaining,
      hasFullAccess,
      canModifyPrompts,
      canCreateReports,
      maxActiveQuestions,
      isAdmin,
    });
  } catch (error) {
    console.error("[GET TRIAL STATUS ERROR]", error);
    res.status(500).json({ error: "Failed to get trial status" });
  }
};
