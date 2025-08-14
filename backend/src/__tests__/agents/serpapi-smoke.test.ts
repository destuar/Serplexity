import { describe, expect, it } from "@jest/globals";
import { fetchGoogleAiOverview } from "../../services/serpApiService";

describe("SerpAPI smoke test", () => {
  it("fetches AI Overview for a simple query (US)", async () => {
    if (!process.env.SERP_API_KEY) {
      console.warn("SERP_API_KEY not set; skipping SerpAPI smoke test");
      return;
    }
    const res = await fetchGoogleAiOverview(
      "What is the best pizza in New York?",
      { hl: "en", gl: "us" }
    );
    expect(res).toBeDefined();
    // We don't assert present strictly (depends on Google); just ensure call works
    expect(res.raw).toBeDefined();
  }, 20000);
});
