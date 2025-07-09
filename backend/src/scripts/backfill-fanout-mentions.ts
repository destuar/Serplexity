import prisma from '../config/db';

// --- Helper utilities copied from reportWorker.ts (keep in sync) ---

function normalizeNameForDeduplication(name: string): string {
  if (!name) return '';
  let normalized = name.toLowerCase();
  const suffixRegex = /\s*,?\s*\b(llc|inc|corp|corporation|ltd|company|co)\b\.?$/;
  normalized = normalized.replace(suffixRegex, '').trim();
  normalized = normalized.replace(/[^a-z0-9\s]/g, '');
  normalized = normalized.replace(/\s+/g, ' ').trim();
  return normalized;
}

const standardizeWebsite = (website: string | null | undefined): string => {
  if (!website) return '';
  return website.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
};

/**
 * Simple slugify helper to generate a deterministic, lowercase, URL-safe slug.
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60); // keep it short enough for unique index
}

async function main() {
  const companies = await prisma.company.findMany({
    include: { competitors: true },
  });

  console.log(`[BACKFILL] Found ${companies.length} companies to process`);

  for (const company of companies) {
    const companyNameLower = company.name.toLowerCase();
    console.log(`\n[BACKFILL] Processing company ${company.name} (${company.id})`);

    // Build look-up structures for fast duplicate detection
    const competitorMap = new Map<string, typeof company.competitors[number]>(); // key = lower-cased name
    const existingNames = new Set<string>();
    const existingWebsites = new Set<string>();

    for (const c of company.competitors) {
      competitorMap.set(c.name.toLowerCase(), c);
      existingNames.add(normalizeNameForDeduplication(c.name));
      existingWebsites.add(standardizeWebsite(c.website));
    }
    // Prevent self-duplicate
    existingNames.add(normalizeNameForDeduplication(company.name));
    existingWebsites.add(standardizeWebsite(company.website));

    // Get responses that still lack mentions for this company
    const responses = await prisma.fanoutResponse.findMany({
      where: {
        fanoutQuestion: { companyId: company.id },
        mentions: { none: {} }, // skip if mentions already exist
      },
      include: {
        fanoutQuestion: { select: { id: true } },
      },
    });

    if (!responses.length) {
      console.log(`  No responses requiring backfill – skipping.`);
      continue;
    }

    console.log(`  Backfilling ${responses.length} responses…`);

    for (const response of responses) {
      const content = response.content;
      if (!content) continue;

      // Extract brand tags in order of appearance
      const brandTagRegex = /<brand>(.*?)<\/brand>/gi;
      const taggedMentions: string[] = [];
      let match;
      while ((match = brandTagRegex.exec(content)) !== null) {
        if (match[1]) taggedMentions.push(match[1].trim());
      }

      if (taggedMentions.length === 0) continue;

      // Use a Set to de-duplicate by entity id later, but preserve appearance order for position
      const uniqueMentions: Array<{ entityId: string; isCompany: boolean }> = [];
      const seen = new Set<string>();

      for (const tag of taggedMentions) {
        const tagLower = tag.toLowerCase();

        let entityId: string | undefined;
        let isCompany = false;

        if (tagLower === companyNameLower) {
          entityId = company.id;
          isCompany = true;
        } else {
          // Attempt to find existing competitor by name or website
          const normalizedTagName = normalizeNameForDeduplication(tag);
          const placeholderWebsite = `generated-${slugify(tag)}.example`;
          const standardizedWebsite = standardizeWebsite(placeholderWebsite);

          if (competitorMap.has(tagLower)) {
            entityId = competitorMap.get(tagLower)!.id;
          } else if (existingNames.has(normalizedTagName) || existingWebsites.has(standardizedWebsite)) {
            // Fetch from DB if not in map (could be name variant)
            const existing = await prisma.competitor.findFirst({
              where: {
                companyId: company.id,
                OR: [
                  { name: tag },
                  { website: standardizedWebsite },
                ],
              },
            });
            if (existing) {
              competitorMap.set(existing.name.toLowerCase(), existing);
              entityId = existing.id;
            }
          }

          if (!entityId) {
            try {
              const created = await prisma.competitor.create({
                data: {
                  name: tag,
                  website: standardizedWebsite,
                  companyId: company.id,
                  isGenerated: true,
                },
              });
              competitorMap.set(created.name.toLowerCase(), created);
              existingNames.add(normalizeNameForDeduplication(created.name));
              existingWebsites.add(standardizeWebsite(created.website));
              entityId = created.id;
            } catch (err: any) {
              if (err.code === 'P2002') {
                // Another parallel create beat us. Retrieve existing row.
                const existing = await prisma.competitor.findFirst({
                  where: { companyId: company.id, website: standardizedWebsite },
                });
                if (existing) {
                  competitorMap.set(existing.name.toLowerCase(), existing);
                  entityId = existing.id;
                }
              } else {
                throw err;
              }
            }
          }
        }

        if (entityId && !seen.has(entityId)) {
          uniqueMentions.push({ entityId, isCompany });
          seen.add(entityId);
        }
      }

      if (uniqueMentions.length === 0) continue;

      // Insert mentions – keep DB constraints small batch per response
      await prisma.fanoutMention.createMany({
        data: uniqueMentions.map((m, idx) => ({
          fanoutResponseId: response.id,
          position: idx + 1,
          ...(m.isCompany ? { companyId: m.entityId } : { competitorId: m.entityId }),
        })),
      });
    }
  }

  console.log(`\n[BACKFILL] Completed!`);
}

main()
  .catch(err => {
    console.error('[BACKFILL] Fatal error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect()); 