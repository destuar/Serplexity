/**
 * @file index.ts
 * @description This file serves as a barrel, exporting all the prompts from the `prompts` directory.
 * This allows for a single point of import for all prompts, making it easier to manage and use them throughout the application.
 *
 * @exports
 * - All exports from `./fanoutPrompt`
 * - All exports from `./brandTag`
 * - All exports from `./sentimentPrompts`
 * - All exports from `./questionPrompts`
 * - All exports from `./websiteEnrichmentPrompts`
 */
export * from './fanoutPrompt';
export * from './brandTag';
export * from './sentimentPrompts';
export * from './questionPrompts';
export * from './websiteEnrichmentPrompts'; 