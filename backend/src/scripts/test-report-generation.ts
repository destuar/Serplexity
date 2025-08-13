import { queueReport } from "../services/reportSchedulingService";

async function main() {
  const companyId = "cmdqid8lw0002caa614jxjsyu"; // Serplexity

  console.log("🚀 Testing report generation for Serplexity...");
  console.log(`📊 Company ID: ${companyId}`);

  try {
    const result = await queueReport(companyId, true);
    console.log("✅ Report generation queued successfully\!");
    console.log("📋 Run ID:", result.runId);
    console.log("🔍 Result:", result);
  } catch (error) {
    console.error("❌ Report generation failed:", error);
  }
}

main().catch(console.error);
