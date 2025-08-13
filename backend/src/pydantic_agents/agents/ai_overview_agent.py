#!/usr/bin/env python3
"""
AI Overview Agent

Uses Playwright (headless Chromium) to open a Google SERP for a given query,
detect if an "AI Overview" is present, and extract its contents and citations.

Input: AiOverviewInput
Output: AiOverviewResult
"""

import asyncio
import json
import logging
import os
import re
import sys
import time
import random
from typing import Any, Dict, List, Optional, Type

from pydantic import BaseModel
from ..base_agent import BaseAgent
from ..schemas import AiOverviewInput, AiOverviewResult, CitationSource


logger = logging.getLogger(__name__)


class AIOverviewAgent(BaseAgent):
    def __init__(self):
        # This agent does not call LLMs; but BaseAgent requires a model. Use a benign default.
        super().__init__(
            agent_id="ai_overview_agent",
            default_model="openai:gpt-4.1-mini",
            system_prompt="You are a browser automation agent extracting Google AI Overviews.",
            temperature=0.0,
            timeout=30000,
            max_retries=1,
        )

    def get_output_type(self):
        return AiOverviewResult

    # Report a browser source instead of an LLM model in metadata
    def _extract_model_used(self, result: Any) -> str:  # type: ignore[override]
        return "ai-overview"

    async def process_input(self, input_data: Dict[str, Any]) -> str:
        # Not used to generate a model prompt; we overload execute() to run Playwright.
        query = input_data.get("query", "")
        return query

    async def execute(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        start = time.time()

        try:
            payload = AiOverviewInput(**input_data)
        except Exception as e:
            elapsed = int((time.time() - start) * 1000)
            return {
                "result": AiOverviewResult(
                    present=False,
                    query=input_data.get("query", ""),
                    serpUrl="",
                    answerText=None,
                    htmlSnippet=None,
                    citations=[],
                    detectedSelectors=[],
                    userAgent=payload.userAgent if isinstance(payload, AiOverviewInput) else None,
                    locale=None,
                    timingMs=elapsed,
                    error=f"invalid_input: {str(e)}",
                ),
                "metadata": self._extract_metadata(None, elapsed, 1),
                "usage": None,
                "execution_time": elapsed,
                "attempt_count": 1,
                "agent_id": self.agent_id,
                "model_used": self._extract_model_used(None),
                "tokens_used": 0,
                "modelUsed": self._extract_model_used(None),
                "tokensUsed": 0,
            }

        # Lazy import to avoid Playwright import cost at module import time
        try:
            from playwright.async_api import async_playwright
        except Exception as e:
            elapsed = int((time.time() - start) * 1000)
            return {
                "result": AiOverviewResult(
                    present=False,
                    query=payload.query,
                    serpUrl="",
                    answerText=None,
                    htmlSnippet=None,
                    citations=[],
                    detectedSelectors=[],
                    userAgent=payload.userAgent,
                    locale=f"{payload.hl}-{payload.gl}" if payload.hl and payload.gl else None,
                    timingMs=elapsed,
                    error=f"playwright_not_available: {str(e)}",
                ),
                "metadata": self._extract_metadata(None, elapsed, 1),
                "usage": None,
                "execution_time": elapsed,
                "attempt_count": 1,
                "agent_id": self.agent_id,
                "model_used": self._extract_model_used(None),
                "tokens_used": 0,
                "modelUsed": self._extract_model_used(None),
                "tokensUsed": 0,
            }

        elapsed = 0
        detected_selectors: List[str] = []
        answer_text: Optional[str] = None
        html_snippet: Optional[str] = None
        citations: List[CitationSource] = []
        serp_url = ""

        # Build SERP URL
        params = [
            ("q", payload.query),
            ("hl", payload.hl or "en"),
            ("gl", payload.gl or "us"),
        ]
        if payload.tbs:
            params.append(("tbs", payload.tbs))
        from urllib.parse import urlencode
        url = f"https://www.google.com/search?{urlencode(params)}"

        proxy = None
        if payload.proxyUrl:
            proxy = {"server": payload.proxyUrl}

        # Rotate common desktop Chrome UAs lightly to reduce blocks
        ua_pool = [
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
        ]
        user_agent = payload.userAgent or random.choice(ua_pool)

        # Selectors to try for AI Overview region
        ai_selectors = [
            "role=region[name=/AI Overview/i]",
            "div[aria-label='AI Overview']",
            "div:has-text('AI Overview')",
            "div[data-hveid][data-ved] div:has([role='heading']:has-text('AI Overview'))",
            "div[role='complementary']:has-text('AI Overview')",
        ]

        try:
            async with async_playwright() as p:
                # Stealth-ish launch args
                browser = await p.chromium.launch(
                    headless=True,
                    args=[
                        "--disable-blink-features=AutomationControlled",
                        "--no-first-run",
                        "--no-default-browser-check",
                    ],
                )

                # Persistent storage state to keep consent cookies between runs
                state_dir = os.path.join(
                    os.path.dirname(__file__), "..", "..", "..", "tmp", "playwright"
                )
                os.makedirs(state_dir, exist_ok=True)
                state_path = os.path.abspath(os.path.join(state_dir, "google_state.json"))

                context_args: Dict[str, Any] = {
                    "user_agent": user_agent,
                    "locale": (payload.hl or "en"),
                    "timezone_id": "America/New_York",
                }
                if proxy:
                    context_args["proxy"] = proxy
                if os.path.exists(state_path):
                    context = await browser.new_context(storage_state=state_path, **context_args)
                else:
                    context = await browser.new_context(**context_args)

                # Reduce automation signals
                await context.add_init_script(
                    """
                    Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
                    Object.defineProperty(navigator, 'plugins', {get: () => [1, 2, 3]});
                    Object.defineProperty(navigator, 'languages', {get: () => ['en-US', 'en']});
                    """
                )
                page = await context.new_page()

                nav_timeout = int(payload.timeoutMs or 15000)
                page.set_default_timeout(nav_timeout)
                await page.goto(url, wait_until="domcontentloaded", timeout=nav_timeout)
                # Handle consent, if present
                try:
                    # Common consent buttons
                    consent_selectors = [
                        "button:has-text('I agree')",
                        "button:has-text('Accept all')",
                        "button[aria-label='Accept all']",
                    ]
                    for sel in consent_selectors:
                        btn = await page.query_selector(sel)
                        if btn:
                            await btn.click()
                            await page.wait_for_timeout(200)
                            break
                except Exception:
                    pass

                # Wait for network to settle
                try:
                    await page.wait_for_load_state("networkidle", timeout=nav_timeout)
                except Exception:
                    pass

                # Detect anti-bot/CAPTCHA
                block_indicators = [
                    "#captcha-form",
                    "text=/unusual traffic/i",
                    "text=/verify/i",
                    "text=/missing or invalid/i",
                ]
                for bi in block_indicators:
                    if await page.locator(bi).first.is_visible():
                        elapsed = int((time.time() - start) * 1000)
                        await context.close()
                        await browser.close()
                        return {
                            "result": AiOverviewResult(
                                present=False,
                                query=payload.query,
                                serpUrl=page.url,
                                answerText=None,
                                htmlSnippet=None,
                                citations=[],
                                detectedSelectors=[],
                                userAgent=user_agent,
                                locale=f"{payload.hl}-{payload.gl}" if payload.hl and payload.gl else None,
                                timingMs=elapsed,
                                error="captcha_blocked",
                            ),
                            "metadata": self._extract_metadata(None, elapsed, 1),
                            "usage": None,
                            "execution_time": elapsed,
                            "attempt_count": 1,
                            "agent_id": self.agent_id,
                            "model_used": self._extract_model_used(None),
                            "tokens_used": 0,
                            "modelUsed": self._extract_model_used(None),
                            "tokensUsed": 0,
                        }

                # Try to locate AI Overview region
                region = None
                for sel in ai_selectors:
                    try:
                        if sel.startswith("role="):
                            # Playwright role selector
                            region_loc = page.get_by_role("region", name=re.compile(r"AI Overview", re.I))
                            if await region_loc.first.is_visible():
                                region = region_loc.first
                                detected_selectors.append(sel)
                                break
                        else:
                            loc = page.locator(sel)
                            if await loc.first.is_visible():
                                region = loc.first
                                detected_selectors.append(sel)
                                break
                    except Exception:
                        continue

                if region:
                    # Expand if there is a show more
                    try:
                        show_more = region.locator("button:has-text('Show more')")
                        if await show_more.first.is_visible():
                            await show_more.first.click()
                            # small wait for expansion
                            await page.wait_for_timeout(300)
                    except Exception:
                        pass

                    # Extract text
                    try:
                        answer_text = await region.inner_text()
                    except Exception:
                        answer_text = None

                    # Extract citations within the region
                    try:
                        links = region.locator("a[href]")
                        count = await links.count()
                        pos = 1
                        for i in range(count):
                            href = await links.nth(i).get_attribute("href")
                            if not href:
                                continue
                            title = (await links.nth(i).inner_text()).strip() or href
                            domain = self._domain_from_url(href)
                            citations.append(CitationSource(url=href, title=title, domain=domain))
                            pos += 1
                    except Exception:
                        pass

                    # Trim HTML snippet
                    try:
                        html_snippet = await region.evaluate("el => el.outerHTML")
                        if html_snippet and len(html_snippet) > 10000:
                            html_snippet = html_snippet[:10000]
                    except Exception:
                        html_snippet = None

                serp_url = page.url

                # Persist storage state (consent etc.) for next runs
                try:
                    await context.storage_state(path=state_path)
                except Exception:
                    pass
                await context.close()
                await browser.close()

        except Exception as e:
            elapsed = int((time.time() - start) * 1000)
            return {
                "result": AiOverviewResult(
                    present=False,
                    query=payload.query,
                    serpUrl=serp_url or url,
                    answerText=None,
                    htmlSnippet=None,
                    citations=[],
                    detectedSelectors=detected_selectors,
                    userAgent=user_agent,
                    locale=f"{payload.hl}-{payload.gl}" if payload.hl and payload.gl else None,
                    timingMs=elapsed,
                    error=f"navigation_error: {str(e)}",
                ),
                "metadata": self._extract_metadata(None, elapsed, 1),
                "usage": None,
                "execution_time": elapsed,
                "attempt_count": 1,
                "agent_id": self.agent_id,
                "model_used": self._extract_model_used(None),
                "tokens_used": 0,
                "modelUsed": self._extract_model_used(None),
                "tokensUsed": 0,
            }

        elapsed = int((time.time() - start) * 1000)
        return {
            "result": AiOverviewResult(
                present=bool(answer_text),
                query=payload.query,
                serpUrl=serp_url or url,
                answerText=answer_text,
                htmlSnippet=html_snippet,
                citations=citations,
                detectedSelectors=detected_selectors,
                userAgent=user_agent,
                locale=f"{payload.hl}-{payload.gl}" if payload.hl and payload.gl else None,
                timingMs=elapsed,
                error=None if answer_text else "not_found",
            ),
            "metadata": self._extract_metadata(None, elapsed, 1),
            "usage": None,
            "execution_time": elapsed,
            "attempt_count": 1,
            "agent_id": self.agent_id,
            "model_used": self._extract_model_used(None),
            "tokens_used": 0,
            "modelUsed": self._extract_model_used(None),
            "tokensUsed": 0,
        }

    def _domain_from_url(self, url: str) -> str:
        try:
            from urllib.parse import urlparse
            return urlparse(url).netloc.replace("www.", "")
        except Exception:
            return ""


async def main():
    # Set up logging to stderr to avoid polluting JSON
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[logging.StreamHandler(sys.stderr)]
    )
    try:
        input_data = json.loads(sys.stdin.read())
        agent = AIOverviewAgent()
        result = await agent.execute(input_data)
        # If result['result'] is a BaseModel, dump it
        if 'result' in result and hasattr(result['result'], 'model_dump'):
            result['result'] = result['result'].model_dump()
        print(json.dumps(result, indent=2, default=str))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
