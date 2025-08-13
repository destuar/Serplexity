import { getProxyUrlFromSecrets } from "../services/networkProxy";
import { pydanticLlmService } from "../services/pydanticLlmService";

async function main() {
  const proxyUrl =
    (await getProxyUrlFromSecrets()) ||
    process.env.HTTP_PROXY ||
    process.env.HTTPS_PROXY ||
    undefined;

  const input = {
    query: "What is the best pizza in new york?",
    hl: "en",
    gl: "us",
    timeoutMs: 15000,
    proxyUrl,
  } as const;

  const result = await pydanticLlmService.executeAgent(
    "ai_overview_agent.py",
    input,
    null,
    { timeout: 25000 }
  );

  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
