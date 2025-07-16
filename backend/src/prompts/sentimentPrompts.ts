/**
 * @file sentimentPrompts.ts
 * @description This file defines the system prompts for analyzing market sentiment and perception of companies
 * across multiple categories including quality, price/value, brand reputation, brand trust, and customer service.
 * It provides prompt builders for generating AI-powered sentiment analysis ratings and comprehensive summaries
 * based on market research and customer feedback patterns. This is a core component for the sentiment analysis
 * features in the dashboard, enabling data-driven insights into company perception across different industries.
 *
 * @exports
 * - buildSentimentRatingPrompt: Function that generates prompts for rating company sentiment across 5 key categories.
 * - SentimentAverages: Interface defining the structure for sentiment score averages.
 * - buildSentimentSummaryPrompt: Function that generates prompts for creating executive summaries of sentiment findings.
 */
import { z } from 'zod';

export function buildSentimentRatingPrompt(companyName: string, industry: string): string {
  return `You are an expert business analyst specializing in market research and sentiment analysis.

**Instructions:** Analyze the market perception and sentiment for the company "${companyName}" in the "${industry}" industry. Rate each category on a scale of 1-10 based on typical market sentiment, customer reviews, and industry reputation.

**Rating Guidelines:**
- **Quality (1-10):** Product/service reliability, durability, performance
- **Price/Value (1-10):** Cost-effectiveness, value for money, competitive pricing
- **Brand Reputation (1-10):** Overall market standing, prestige, recognition
- **Brand Trust (1-10):** Customer confidence, reliability, transparency
- **Customer Service (1-10):** Support quality, responsiveness, helpfulness

**JSON Output Format:**
{
  "companyName": "Apple",
  "industry": "Technology",
  "ratings": [{
    "quality": 9,
    "priceValue": 4,
    "brandReputation": 9,
    "brandTrust": 8,
    "customerService": 7,
    "summaryDescription": "Apple consistently receives high marks for product quality and innovation, with strong brand loyalty and trust. However, the company faces significant criticism for premium pricing that many consider excessive for the value provided. Customer service is generally regarded as helpful but can be inconsistent across different channels."
  }]
}

**Your Task:**
Company: "${companyName}"
Industry: "${industry}"
Follow the exact JSON structure shown in the examples above. Ensure all ratings are integers between 1-10.`;
}

export interface SentimentAverages {
  quality: number;
  priceValue: number;
  brandReputation: number;
  brandTrust: number;
  customerService: number;
}

export function buildSentimentSummaryPrompt(companyName: string, averages: SentimentAverages): string {
  return `Write a comprehensive 2-3 sentence summary that explains the overall sentiment findings for ${companyName}.

**Calculated Average Scores (1-10 scale):**
- Quality: ${averages.quality}/10
- Price/Value: ${averages.priceValue}/10  
- Brand Reputation: ${averages.brandReputation}/10
- Brand Trust: ${averages.brandTrust}/10
- Customer Service: ${averages.customerService}/10

Return ONLY the summary text. Do not include JSON formatting, numbers, or any other structured data.`;
} 