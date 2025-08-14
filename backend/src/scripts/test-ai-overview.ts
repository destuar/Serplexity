/* eslint-disable max-lines-per-function, max-statements, complexity, no-console, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, @typescript-eslint/no-floating-promises */
import axios from "axios";
import dotenv from "dotenv";
import path from "path";

// Load backend/.env explicitly (avoid importing app env validator)
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

async function main() {
  const apiKey = process.env.SERP_API_KEY || process.env.SERPAPI_API_KEY;
  if (!apiKey) {
    console.error(
      "FATAL: SERP_API_KEY is missing. Add it to backend/.env as SERP_API_KEY=..."
    );
    process.exit(1);
  }

  const queryArg = process.argv.slice(2).join(" ");
  const query = queryArg || "What is the best place for pizza in New York?";

  const common = {
    q: query,
    api_key: apiKey,
    hl: "en",
    gl: "us",
    device: "desktop",
    google_domain: "google.com",
    no_cache: "true",
  } as const;

  const call = async (engine: string) => {
    const url = "https://serpapi.com/search.json";
    const params =
      engine === "google_ai_overview"
        ? {
            engine,
            q: common.q,
            api_key: common.api_key,
            hl: common.hl,
            gl: common.gl,
          }
        : { engine, ...common };
    const resp = await axios.get(url, { params, timeout: 20000 });
    return resp.data;
  };

  try {
    console.log(`Query: ${query}`);
    console.log("=== engine=google (inline AI Overview when available) ===");
    const res1 = await call("google");
    console.log(JSON.stringify(res1, null, 2));

    console.log("\n=== engine=google_ai_overview (dedicated) ===");
    let res2: any;
    const pageToken: string | undefined = res1?.ai_overview?.page_token;
    try {
      if (pageToken) {
        const url = "https://serpapi.com/search.json";
        const params = {
          engine: "google_ai_overview",
          page_token: pageToken,
          api_key: apiKey,
        } as const;
        const resp = await axios.get(url, { params, timeout: 20000 });
        res2 = resp.data;
      } else {
        res2 = await call("google_ai_overview");
      }
    } catch (e) {
      // If page_token path fails, try query-based as a fallback
      try {
        res2 = await call("google_ai_overview");
      } catch (e2) {
        throw e2;
      }
    }
    console.log(JSON.stringify(res2, null, 2));
  } catch (err: any) {
    const msg = err?.response?.data
      ? JSON.stringify(err.response.data, null, 2)
      : String(err?.message || err);
    console.error("Request failed:\n", msg);
    process.exit(1);
  }
}

main();
