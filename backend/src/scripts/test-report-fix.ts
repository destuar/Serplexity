#!/usr/bin/env ts-node

/**
 * Test script to queue a report for Diego's Gold House company
 */

import { getDbClient } from "../config/database";
import { dbCache } from "../config/dbCache";
import { queueReport } from "../services/reportSchedulingService";

async function testReportFix() {
  console.log("🧪 Testing Report Fix - Queuing new report for Gold House");
  console.log("=" .repeat(60));

  try {
    // Initialize database
    await dbCache.initialize();
    const prisma = await getDbClient();

    // Find Diego's Gold House company
    const company = await prisma.company.findFirst({
      where: {
        name: "Gold House",
        user: {
          email: "diegojestuar@gmail.com"
        }
      },
      include: {
        user: true,
        questions: {
          where: { isActive: true }
        }
      }
    });

    if (!company) {
      console.log("❌ Could not find Gold House company for Diego");
      return;
    }

    console.log(`✅ Found company: ${company.name}`);
    console.log(`📧 Owner: ${company.user.email}`);
    console.log(`📊 Active questions: ${company.questions.length}`);
    
    if (company.questions.length === 0) {
      console.log("❌ No active questions found - cannot generate report");
      return;
    }

    console.log("\n📝 Active questions:");
    company.questions.forEach((q, i) => {
      console.log(`  ${i + 1}. [${q.type || 'unknown'}] ${q.query.substring(0, 60)}...`);
    });

    console.log("\n🚀 Queuing report generation...");
    
    // Queue the report
    await queueReport(company.id, true); // force = true
    
    console.log("✅ Report queued successfully!");
    console.log("\n📋 Next steps:");
    console.log("1. Monitor the report progress with: npm run ops:monitor");
    console.log("2. Check the logs for plan limit enforcement messages");
    console.log("3. Verify all 5 questions get processed");

  } catch (error) {
    console.error("💥 Error:", error);
  } finally {
    await dbCache.close();
  }
}

// Run the test
testReportFix().catch(console.error);