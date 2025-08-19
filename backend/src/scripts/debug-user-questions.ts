#!/usr/bin/env ts-node

/**
 * Debug script to check user plan limits and active questions
 */

import { getDbClient } from "../config/database";
import { getPlanLimitsForUser } from "../services/planService";
import { dbCache } from "../config/dbCache";

async function debugUserQuestions() {
  console.log("🔍 Debugging User Questions and Plan Limits");
  console.log("=" .repeat(50));

  try {
    // Initialize database
    await dbCache.initialize();
    const prisma = await getDbClient();

    // Get the first user (assuming you're the only user)
    const users = await prisma.user.findMany({
      take: 5,
      include: {
        companies: {
          include: {
            questions: {
              where: { isActive: true },
              orderBy: { createdAt: "asc" },
            },
            runs: {
              take: 3,
              orderBy: { createdAt: "desc" },
              select: {
                id: true,
                status: true,
                stepStatus: true,
                createdAt: true,
                responses: {
                  select: {
                    id: true,
                    model: true,
                    questionId: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (users.length === 0) {
      console.log("❌ No users found");
      return;
    }

    for (const user of users) {
      console.log(`\n👤 User: ${user.name || user.email}`);
      console.log(`📧 Email: ${user.email}`);
      console.log(`🏢 Companies: ${user.companies.length}`);

      // Get plan limits for this user
      try {
        const planLimits = await getPlanLimitsForUser(user.id);
        console.log(`\n📊 Plan Limits:`);
        console.log(`  - Models per report: ${planLimits.modelsPerReportMax}`);
        console.log(`  - Prompts per report: ${planLimits.promptsPerReportMax}`);
        console.log(`  - Reports per month: ${planLimits.reportsPerMonth}`);
        console.log(`  - Company profiles: ${planLimits.companyProfiles}`);
      } catch (error) {
        console.log(`❌ Could not get plan limits: ${error}`);
      }

      // Check each company
      for (const company of user.companies) {
        console.log(`\n  🏢 Company: ${company.name}`);
        console.log(`  🌐 Website: ${company.website}`);
        console.log(`  📝 Questions Ready: ${company.questionsReady}`);
        console.log(`  📊 Active Questions: ${company.questions.length}`);

        // List active questions
        if (company.questions.length > 0) {
          console.log(`\n  📝 Active Questions:`);
          company.questions.forEach((question, index) => {
            console.log(`    ${index + 1}. [${question.type || 'unknown'}] ${question.query.substring(0, 80)}...`);
            console.log(`       Intent: ${question.intent || 'none'} | Source: ${question.source}`);
          });
        }

        // Check recent report runs
        if (company.runs.length > 0) {
          console.log(`\n  📈 Recent Reports:`);
          company.runs.forEach((run, index) => {
            console.log(`    ${index + 1}. ${run.id} - ${run.status} (${run.createdAt.toLocaleDateString()})`);
            if (run.stepStatus) {
              console.log(`       Step: ${run.stepStatus}`);
            }
            console.log(`       Responses: ${run.responses.length}`);
            
            // Group responses by question
            const responsesByQuestion = run.responses.reduce((acc: Record<string, any[]>, response) => {
              if (!acc[response.questionId]) {
                acc[response.questionId] = [];
              }
              acc[response.questionId].push(response);
              return acc;
            }, {});

            console.log(`       Questions with responses: ${Object.keys(responsesByQuestion).length}`);
            
            // Show which models responded to each question
            for (const [questionId, responses] of Object.entries(responsesByQuestion)) {
              const question = company.questions.find(q => q.id === questionId);
              const models = responses.map(r => r.model).join(', ');
              console.log(`         - "${question?.query.substring(0, 40) || questionId}...": ${models}`);
            }
          });
        }
      }
      console.log("-".repeat(50));
    }

  } catch (error) {
    console.error("💥 Error:", error);
  } finally {
    await dbCache.close();
  }
}

// Run the debug script
debugUserQuestions().catch(console.error);