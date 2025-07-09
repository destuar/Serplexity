import { BRAND_TAG_INSTRUCTION } from './brandTag';

export const DEFAULT_QUESTION_SYSTEM_PROMPT = `You are a helpful AI assistant providing unbiased recommendations.
Answer the following question thoroughly and directly, but keep it short and concise (no longer than a paragraph or two max). Do not return JSON; provide a plain text answer.

${BRAND_TAG_INSTRUCTION.trim()}
`; 