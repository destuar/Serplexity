/**
 * Script to fix existing user accounts that don't have trial information set
 */
import { getPrismaClient } from "../config/dbCache";

async function fixUserTrial() {
  const prisma = await getPrismaClient();
  
  try {
    // Find users with null subscription status (created before the fix)
    const usersToFix = await prisma.user.findMany({
      where: {
        subscriptionStatus: null,
        role: { not: "ADMIN" }, // Don't touch admin accounts
      },
      select: {
        id: true,
        email: true,
        createdAt: true,
      },
    });

    console.log(`Found ${usersToFix.length} users to fix`);

    for (const user of usersToFix) {
      // Set trial to start from their account creation date
      const trialStartedAt = user.createdAt;
      const trialEndsAt = new Date(trialStartedAt.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
      
      console.log(`Fixing user ${user.email}:`);
      console.log(`  Trial started: ${trialStartedAt.toISOString()}`);
      console.log(`  Trial ends: ${trialEndsAt.toISOString()}`);
      
      await prisma.user.update({
        where: { id: user.id },
        data: {
          subscriptionStatus: "trialing",
          trialStartedAt,
          trialEndsAt,
        },
      });
      
      console.log(`  ✅ Fixed!`);
    }

    console.log("All users fixed successfully!");
  } catch (error) {
    console.error("Error fixing users:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
fixUserTrial().catch(console.error);