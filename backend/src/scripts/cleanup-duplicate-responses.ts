#!/usr/bin/env npx tsx

/**
 * Cleanup duplicate fanoutResponse records
 * Keeps the most recent record for each (fanoutQuestionId, model, content) combination
 * 
 * Usage: npx tsx src/scripts/cleanup-duplicate-responses.ts
 */

import prisma from '../config/db';

async function cleanupDuplicateResponses() {
  console.log('[CLEANUP] Starting duplicate fanoutResponse cleanup...');

  // Find all duplicate groups
  const duplicates = await prisma.fanoutResponse.groupBy({
    by: ['fanoutQuestionId', 'model', 'content'],
    _count: { id: true },
    having: { id: { _count: { gt: 1 } } }
  });

  console.log(`[CLEANUP] Found ${duplicates.length} duplicate groups`);

  let totalDeleted = 0;

  for (const duplicate of duplicates) {
    try {
      // Get all records for this duplicate group
      const records = await prisma.fanoutResponse.findMany({
        where: {
          fanoutQuestionId: duplicate.fanoutQuestionId,
          model: duplicate.model,
          content: duplicate.content
        },
        orderBy: { createdAt: 'desc' }, // Most recent first
        select: { id: true, createdAt: true }
      });

      if (records.length <= 1) continue; // Skip if no duplicates found

      // Keep the first (most recent) record, delete the rest
      const toKeep = records[0];
      const toDelete = records.slice(1);

      console.log(`[CLEANUP] Question ${duplicate.fanoutQuestionId}, Model ${duplicate.model}: keeping ${toKeep.id} (${toKeep.createdAt}), deleting ${toDelete.length} older records`);

      // Delete older records and their mentions
      for (const record of toDelete) {
        // First delete related mentions to avoid foreign key constraints
        await prisma.fanoutMention.deleteMany({
          where: { fanoutResponseId: record.id }
        });

        // Then delete the response
        await prisma.fanoutResponse.delete({
          where: { id: record.id }
        });

        totalDeleted++;
      }

    } catch (error) {
      console.error(`[CLEANUP] Error processing duplicate for question ${duplicate.fanoutQuestionId}, model ${duplicate.model}:`, error);
    }
  }

  console.log(`[CLEANUP] Complete! Deleted ${totalDeleted} duplicate responses`);
}

// Run the cleanup
cleanupDuplicateResponses()
  .then(() => {
    console.log('[CLEANUP] Script finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('[CLEANUP] Script failed:', error);
    process.exit(1);
  }); 