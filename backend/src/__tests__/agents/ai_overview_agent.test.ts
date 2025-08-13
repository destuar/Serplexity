import { describe, expect, it } from "@jest/globals";
import { pydanticLlmService } from "../../services/pydanticLlmService";

describe.skip("AIOverviewAgent", () => {
  it("runs and returns a result object (present may be true or false)", async () => {
    const input = {
      query: "What is the best pizza in new york?",
      hl: "en",
      gl: "us",
      timeoutMs: 12000,
    };

    const result = await pydanticLlmService.executeAgent(
      "ai_overview_agent.py",
      input,
      null,
      { timeout: 20000 }
    );

    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("metadata");
    const data = result.data as any;
    expect(data).toHaveProperty("present");
    expect(data).toHaveProperty("query");
    expect(data.query).toContain("pizza");
  }, 30000);
});
