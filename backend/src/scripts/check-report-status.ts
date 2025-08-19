#!/usr/bin/env ts-node

/**
 * Check the status of the latest report
 */

import { getDbClient } from "../config/database";
import { dbCache } from "../config/dbCache";

async function checkReportStatus() {
  console.log("📊 Checking Latest Report Status");
  console.log("=" .repeat(50));

  try {
    // Initialize database
    await dbCache.initialize();
    const prisma = await getDbClient();

    // Get the latest report for Gold House
    const latestReport = await prisma.reportRun.findFirst({
      where: {
        company: {
          name: "Gold House",
          user: {
            email: "diegojestuar@gmail.com"
          }
        }
      },
      orderBy: { createdAt: "desc" },
      include: {
        responses: {
          include: {
            question: {
              select: {
                id: true,
                query: true,
                type: true,
                intent: true
              }
            }
          }
        },
        company: {
          include: {
            questions: {
              where: { isActive: true }
            }
          }
        }
      }
    });

    if (!latestReport) {
      console.log("❌ No reports found");
      return;
    }

    console.log(`📋 Report ID: ${latestReport.id}`);
    console.log(`📅 Created: ${latestReport.createdAt.toLocaleString()}`);
    console.log(`📊 Status: ${latestReport.status}`);
    console.log(`📝 Step: ${latestReport.stepStatus || 'Unknown'}`);
    console.log(`💰 Cost: $${latestReport.usdCost?.toFixed(4) || '0.0000'}`);
    console.log(`🔢 Tokens: ${latestReport.tokensUsed || 0}`);

    console.log(`\n📊 Company Active Questions: ${latestReport.company.questions.length}`);
    console.log(`📊 Report Responses: ${latestReport.responses.length}`);

    // Group responses by question
    const responsesByQuestion = latestReport.responses.reduce((acc: Record<string, any[]>, response) => {
      const questionId = response.question.id;
      if (!acc[questionId]) {
        acc[questionId] = [];
      }
      acc[questionId].push(response);
      return acc;
    }, {});

    console.log(`📊 Questions with responses: ${Object.keys(responsesByQuestion).length}/${latestReport.company.questions.length}`);

    if (Object.keys(responsesByQuestion).length > 0) {
      console.log("\n📝 Response breakdown:");
      for (const [questionId, responses] of Object.entries(responsesByQuestion)) {
        const question = latestReport.company.questions.find(q => q.id === questionId);
        const questionText = question ? question.query.substring(0, 50) + "..." : questionId;
        const models = responses.map(r => r.model).join(', ');
        console.log(`  - "${questionText}": ${responses.length} responses (${models})`);
      }
    }

    // Check if this is the expected improvement
    if (latestReport.status === "COMPLETED") {
      const questionsProcessed = Object.keys(responsesByQuestion).length;
      const totalQuestions = latestReport.company.questions.length;
      
      if (questionsProcessed === totalQuestions && totalQuestions === 5) {
        console.log("\n✅ SUCCESS: All 5 questions were processed!");
        console.log("✅ Fix appears to be working correctly");
      } else if (questionsProcessed < totalQuestions) {
        console.log(`\n⚠️ PARTIAL: Only ${questionsProcessed}/${totalQuestions} questions processed`);
        console.log("⚠️ Issue may still exist");
      } else {
        console.log("\n✅ Report completed successfully");
      }
    } else if (latestReport.status === "RUNNING") {
      console.log("\n⏳ Report is still running - check again in a few minutes");
    } else if (latestReport.status === "FAILED") {
      console.log("\n❌ Report failed - check logs for details");
    }

  } catch (error) {
    console.error("💥 Error:", error);
  } finally {
    await dbCache.close();
  }
}

// Run the check
checkReportStatus().catch(console.error);