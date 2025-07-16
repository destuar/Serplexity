/**
 * @file websiteEnrichmentPrompts.ts
 * @description This file defines the prompt for the website enrichment feature.
 * It instructs the AI to find official website URLs for a given list of company names and return them in a structured JSON format.
 * This is a crucial component for enriching competitor data and ensuring the accuracy of the system's analysis.
 *
 * @exports
 * - buildWebsiteEnrichmentPrompt: A function that constructs the prompt for website enrichment based on a list of competitor names.
 */
export function buildWebsiteEnrichmentPrompt(competitorNames: string[]): string {
  return `Find the official website URL for each company in the list below.

**Instructions:**
1. Return a JSON object with "competitors" key containing an array of objects
2. Each object must have "name" and "website" fields
3. Use exact company names from the input list
4. Ensure websites start with "https://" or "http://"
5. If you cannot find a website for a company, OMIT it from the results

**Companies:**
${competitorNames.map((name, idx) => `${idx + 1}. ${name}`).join('\n')}

**Example Output:**
{
  "competitors": [
    { "name": "Tesla", "website": "https://tesla.com" },
    { "name": "Ford", "website": "https://ford.com" }
  ]
}`;
} 