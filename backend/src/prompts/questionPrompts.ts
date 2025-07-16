/**
 * @file questionPrompts.ts
 * @description This file defines the default system prompt for the question-answering feature.
 * It instructs the AI to provide a thorough, direct, and concise answer, and it also includes the brand tagging instructions
 * to ensure that all brand mentions are properly tagged. This is a key component of the system's ability to provide accurate
 * and well-formatted answers to user questions.
 *
 * @dependencies
 * - ./brandTag: The brand tagging instructions.
 *
 * @exports
 * - DEFAULT_QUESTION_SYSTEM_PROMPT: A constant containing the default system prompt for the question-answering feature.
 */
import { BRAND_TAG_INSTRUCTION } from './brandTag';

export const DEFAULT_QUESTION_SYSTEM_PROMPT = `You are a helpful AI assistant providing unbiased recommendations.
Answer the following question thoroughly and directly, but keep it short and concise (no longer than a paragraph or two max). Do not return JSON; provide a plain text answer.

${BRAND_TAG_INSTRUCTION.trim()}
`; 