import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { generateAndValidate, generateChatCompletion } from './llmService';
import { ModelTask, ModelEngine, getModelsByTask } from '../config/models';

function replacePlaceholders(template: string, context: Record<string, any>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const trimmedKey = key.trim();
    const value = context[trimmedKey];
    if (value !== undefined && value !== null) {
      if (typeof value === 'number') {
        return Number(value.toFixed(2)).toString();
      }
      return String(value);
    }
    return match;
  });
}

const TaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  category: z.enum(['Technical SEO', 'Third-Party Citations', 'Content Creation', 'PR & Thought Leadership', 'Measurement']),
  priority: z.enum(['High', 'Medium', 'Low']),
  impact_metric: z.enum(['shareOfVoice', 'inclusionRate', 'averagePosition', 'sentimentScore']),
});

const TasksArraySchema = z.array(TaskSchema);

interface OptimizationTasksResult {
  tasks: z.infer<typeof TaskSchema>[];
  summary: string;
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

interface CompanyContext {
  name: string;
  industry: string | null;
  website: string;
  competitors: string[];
  hasFirstReport: boolean;
  productKeywords: string[];
}

interface ReportMetricsContext {
  shareOfVoice: number;
  shareOfVoiceChange?: number | null;
  averageInclusionRate: number;
  averageInclusionChange?: number | null;
  averagePosition: number;
  averagePositionChange?: number | null;
  sentimentScore?: number | null;
  sentimentChange?: number | null;
  competitorRankings?: any;
  topQuestions?: any;
}

const OPTIMIZATION_TASKS_PROMPT = `# AI Visibility Task Generator Prompt

You are an expert AI Visibility Strategist working for **{{name}}**, a company in the **{{industry}}** industry. The organisation focuses on the following products/services: **{{productKeywords}}**.

Your job is to produce ONE clear, actionable task that will improve the company's visibility in AI-generated answers and search results. Reference performance metrics generically without including numeric values. Ensure the task is relevant to the industry and products listed.

## Your Output Requirements
- Generate **exactly ONE new task**.
- The task **must NOT duplicate or rephrase** any title from the "disallowedTitles" list provided in the context.
- Return **only valid, minified JSON** for the single task object.

### JSON Schema (single object)
\`\`\`
{
  "id": "T##",
  "title": "<Short Verb-First Title>",
  "description": "<reasoning followed by numbered implementation steps and explanation with specific guidance, e.g., '1. Step one; 2. Step two; 3. Step three'>",
  "category": "<Technical SEO | Third-Party Citations | Content Creation | PR & Thought Leadership | Measurement>",
  "priority": "<High | Medium | Low>",
  "impact_metric": "<shareOfVoice | inclusionRate | averagePosition | sentimentScore>"
}
\`\`\`

### Task-Creation Guidelines
1.  **Personalization**: Reference a relevant metric generically if applicable (no numbers) and incorporate the product/service context. Each description should be differentiated from the others and include detailed implementation steps if necessary.
2.  **Actionable & Specific**: After a brief rationale, list implementation steps in the description and why this task will benefit the company's brand or visibility. Ex. '1. Step one; 2. Step two; 3. Step three' (numbers, period, space, then step, separated by semicolons).
3.  **Priority**: Determine the priority of tasks by how likely it is to have the an immediate impact on the company's brand and visibility.
`;

const SUMMARY_PROMPT = `# AI Visibility Daily Briefing

You are an expert AI Search Visibility consultant providing a daily executive summary.

Below you will find the client's **latest performance metrics** inside a Metrics section.  Use these figures directly in your analysis and wording (they are already substituted with real numbers).

## Metrics
• Share of Voice: {{shareOfVoice}}%  (Δ {{shareOfVoiceChange}})
• Average Inclusion Rate: {{averageInclusionRate}}%  (Δ {{averageInclusionChange}})
• Average Position: {{averagePosition}}  (Δ {{averagePositionChange}})
• Sentiment Score: {{sentimentScore}}  (Δ {{sentimentChange}})
• Top Competitor: {{topCompetitor}}

## Your Output Requirements
Generate a **6–8 sentence** executive summary.  Return ONLY the raw text (no JSON, no markdown, no titles).

### Content Guidelines
1.  **Opening Statement** – high-level assessment of AI visibility.
2.  **Key Win** – reference the metric that improved most.
3.  **Primary Opportunity** – reference the weakest/declined metric.
4.  **Strategic Recommendation** – 1 actionable suggestion tied to the opportunity.
5.  **Closing Statement** – forward-looking or encouraging.

---
**Example Output (Illustrative Only – 6 Sentences):**

Your AI visibility profile is gaining momentum, led by a 4.1-point rise in Share-of-Voice to 23.4 %, signalling broader brand exposure across AI answers. Sentiment also inched up to 7.3 (▲0.6), showing user perception is moving in the right direction. However, your Average Position slipped by 0.4 to 3.2, which means competitors are often cited before you in answer snippets. Inclusion Rate remains stable at 57.8 %, but improving it will magnify the gains from your higher sentiment. To close the position gap, prioritise high-authority, comparison-style content and secure featured spots in respected industry round-ups over the next week. Overall, the trend is upward, and a focused push on authoritative citations should accelerate your lead over your top competitor.`;

// ─────────────────────────────────────────────
// 1️⃣  PRESET TASK CATALOG (15 tasks)
// ─────────────────────────────────────────────

type PresetTask = z.infer<typeof TaskSchema>;

const PRESET_TASKS: PresetTask[] = [
  {
    id: 'S01',
    title: 'Verify robots.txt & llms.txt',
    description: '1. Navigate to https://<domain>/robots.txt in your browser; 2. If the file is missing or blocks key directories, copy a best-practice template from any reputable robots.txt generator; 3. In a text editor, create "llms.txt" with a one-sentence brand description and "Allow: /"; 4. Upload both files via your CMS file manager or hosting control panel; 5. Reload both URLs to confirm they return a 200 status.',
    category: 'Technical SEO',
    priority: 'High',
    impact_metric: 'inclusionRate',
  },
  {
    id: 'S02',
    title: 'Implement Comprehensive Schema Markup',
    description: '1. Use an online schema markup generator and choose "Organization", "Product" and "Article"; 2. Fill in your company details and copy the JSON-LD; 3. In your CMS, paste the code into the global "Header / Custom HTML" field; 4. Save, publish and test three URLs in a rich-results testing tool; 5. If errors appear, edit and retest until green; 6. Resubmit the pages in your search console for faster indexing.',
    category: 'Technical SEO',
    priority: 'High',
    impact_metric: 'averagePosition',
  },
  {
    id: 'S03',
    title: 'Build & Submit XML Sitemap',
    description: '1. Install an XML sitemap plugin in your CMS or use an online XML sitemap generator; 2. Generate the sitemap and note the URL (usually /sitemap.xml); 3. Add "Sitemap: https://<domain>/sitemap.xml" to robots.txt; 4. Submit the sitemap in your preferred search engine webmaster tools; 5. Set a reminder to regenerate it whenever you publish a batch of new pages.',
    category: 'Technical SEO',
    priority: 'Medium',
    impact_metric: 'inclusionRate',
  },
  {
    id: 'S04',
    title: 'Publish Entity Glossary Page',
    description: '1. Make a list of 30–50 brand, product and industry terms customers ask about; 2. Write clear ≤120-word definitions in a shared document; 3. Create a new "Glossary" page in your CMS, add A–Z anchor links and paste the definitions; 4. Link the page in the footer navigation; 5. Whenever you mention a term in future content, link back to its glossary definition.',
    category: 'Content Creation',
    priority: 'Medium',
    impact_metric: 'averagePosition',
  },
  {
    id: 'S05',
    title: 'Launch Long-Tail Blog Series',
    description: '1. Use a keyword research tool to find 12 long-tail questions with low keyword difficulty (<30); 2. Draft one 800-word post per question following a Q&A format; 3. Include an internal link to your product page and one external authoritative source; 4. Publish one post per month and share on LinkedIn, X and your email list; 5. After 30 days, review impressions and clicks in your search console and tweak titles if needed.',
    category: 'Content Creation',
    priority: 'High',
    impact_metric: 'shareOfVoice',
  },
  {
    id: 'S06',
    title: 'Secure Industry Directory Backlinks',
    description: '1. Search your industry directory and pick five reputable sites with high traffic; 2. Prepare a consistent NAP (name, address, phone), 50-word company bio and logo; 3. Create or claim each listing and request a do-follow link to your homepage; 4. Keep a simple record of the live URLs and last review date; 5. Revisit your listings at least once a year to ensure details remain accurate.',
    category: 'Third-Party Citations',
    priority: 'Medium',
    impact_metric: 'shareOfVoice',
  },
  {
    id: 'S07',
    title: 'Collect & Showcase Customer Testimonials',
    description: '1. Export customers who gave a 9 or 10 NPS score or left positive feedback; 2. Send personalized review requests with direct links to popular review platforms; 3. Aim for at least 25 new 4- or 5-star reviews; 4. Copy the best quotes into your product pages using your CMS testimonial block; 5. Repurpose the quotes in social posts and ads.',
    category: 'Third-Party Citations',
    priority: 'Medium',
    impact_metric: 'sentimentScore',
  },
  {
    id: 'S08',
    title: 'Set Up Brand-Mention Alerts',
    description: '1. Set up free brand-mention alerts for your brand, product and founder names; 2. Choose "As-it-happens" delivery to your marketing inbox; 3. Auto-forward these emails to a shared chat channel; 4. Periodically note standout mentions and assign someone to follow up; 5. Reach out to convert unlinked mentions into backlinks or reviews.',
    category: 'Measurement',
    priority: 'Low',
    impact_metric: 'shareOfVoice',
  },
  {
    id: 'S09',
    title: 'Run Quarterly Content Freshness Audit',
    description: '1. Export blog URLs with traffic data from your search console (12-month view); 2. Highlight posts older than 18 months or with a ≥30% traffic drop; 3. Update stats, images and calls-to-action, then change the publish date to today; 4. Add a "Last updated" note at the top; 5. Request indexing in your search console and share refreshed articles on social.',
    category: 'Content Creation',
    priority: 'Medium',
    impact_metric: 'averagePosition',
  },
  {
    id: 'S10',
    title: 'Add FAQ & HowTo Schema',
    description: '1. Identify pages that answer FAQs or explain how to use your product; 2. In your CMS FAQ/HowTo block, add concise Q&A pairs (≤120 chars) or clear step lists; 3. Save and publish; 4. Test in a rich-results testing tool; 5. Request indexing for each updated URL.',
    category: 'Technical SEO',
    priority: 'Medium',
    impact_metric: 'averagePosition',
  },
  {
    id: 'S11',
    title: 'Launch Monthly Micro-Content Pipeline',
    description: '1. Create a shared content calendar titled "Micro-Blog Pipeline" with 12 monthly slots; 2. Assign a subject-matter expert to each slot and give them a 400-word template (H2 + bullet list); 3. Draft, edit and publish within two days; 4. Use a social scheduling tool to auto-share to LinkedIn and X; 5. Review click-through rate in your search console each quarter and adjust topics.',
    category: 'Content Creation',
    priority: 'Low',
    impact_metric: 'inclusionRate',
  },
  {
    id: 'S12',
    title: 'Monthly Structured Data Spot Check',
    description: '1. At the start of each month, paste your top-traffic URLs into a rich-results testing tool; 2. Flag any errors and create a task for your developer or CMS admin; 3. After fixes, retest until all critical issues are cleared; 4. Track the status of each URL to spot progress over time; 5. Repeat the process monthly.',
    category: 'Measurement',
    priority: 'Low',
    impact_metric: 'averagePosition',
  },
  {
    id: 'S13',
    title: 'Publish Proprietary Data Study & PR Outreach',
    description: '1. Pull anonymized usage stats or run a single-question customer poll; 2. Turn the findings into visual charts and a 1,000-word blog post under /research/; 3. Craft a concise media pitch and send it to relevant journalists; 4. Publish the post, share it across social channels and your newsletter, and send the infographic to micro-influencers; 5. Keep a log of any resulting coverage and backlinks.',
    category: 'PR & Thought Leadership',
    priority: 'High',
    impact_metric: 'shareOfVoice',
  },
  {
    id: 'S14',
    title: 'Track & Act on Serplexity Sentiment Drivers',
    description: '1. In your Serplexity dashboard, open the Sentiment Details panel and scan the summaries generated by each LLM model; 2. Identify the two lowest-scoring drivers (e.g., Pricing, Support) that appear consistently across models; 3. Brainstorm at least one improvement idea for each driver and assign someone to own the action; 4. Implement the fixes and revisit Sentiment Details next month to gauge progress and adjust as needed.',
    category: 'Measurement',
    priority: 'High',
    impact_metric: 'sentimentScore',
  },
  {
    id: 'S15',
    title: 'Improve Core Web Vitals for Faster Crawling',
    description: '1. Run your homepage through a page-performance insights tool and note LCP, INP and CLS scores; 2. Compress hero images and re-upload as WebP; 3. Turn on lazy-loading for below-the-fold images in your CMS; 4. Enable a content delivery network (CDN); 5. Re-test and aim for scores ≥80 on mobile; 6. Check again monthly.',
    category: 'Technical SEO',
    priority: 'Medium',
    impact_metric: 'inclusionRate',
  }
];

export async function generateOptimizationTasksAndSummary(
  runId: string,
  companyId: string,
  prisma: PrismaClient,
  forceTaskGeneration: boolean = false,
): Promise<OptimizationTasksResult> {
  
  // Check if this is the first report for the company
  const reportCount = await prisma.reportRun.count({
    where: { 
      companyId,
      status: 'COMPLETED',
      id: { not: runId } // Exclude current run
    }
  });
  
  const isFirstReport = reportCount === 0;
  
  // Get company context
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: { competitors: true, products: true }
  });
  
  if (!company) {
    throw new Error(`Company not found: ${companyId}`);
  }
  
  // Get latest report metrics (aggregated across models for now)
  const latestMetric = await prisma.reportMetric.findFirst({
    where: { reportId: runId },
    orderBy: { createdAt: 'desc' }
  });
  
  if (!latestMetric) {
    throw new Error(`No metrics found for report: ${runId}`);
  }
  
  const companyContext: CompanyContext = {
    name: company.name,
    industry: company.industry,
    website: company.website,
    competitors: company.competitors.map(c => c.name),
    hasFirstReport: isFirstReport,
    productKeywords: company.products.map(p => p.name),
  };
  
  const metricsContext: ReportMetricsContext = {
    shareOfVoice: latestMetric.shareOfVoice,
    shareOfVoiceChange: latestMetric.shareOfVoiceChange,
    averageInclusionRate: latestMetric.averageInclusionRate,
    averageInclusionChange: latestMetric.averageInclusionChange,
    averagePosition: latestMetric.averagePosition,
    averagePositionChange: latestMetric.averagePositionChange,
    sentimentScore: latestMetric.sentimentScore,
    sentimentChange: latestMetric.sentimentChange,
    competitorRankings: latestMetric.competitorRankings,
    topQuestions: latestMetric.topQuestions
  };
  
  // Create a lean version of metrics for task generation to reduce token usage
  const { competitorRankings, topQuestions, ...leanMetricsContext } = metricsContext;
  
  // Create a flattened context for placeholder replacement.
  const fullTemplateContext = {
    ...companyContext,
    ...metricsContext,
    topCompetitor: company.competitors[0]?.name || 'N/A',
  };
  const leanTemplateContext = {
    ...companyContext,
    ...leanMetricsContext,
  };

  let tasks: z.infer<typeof TaskSchema>[] = [];
  let tasksTokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  
  // Prefer a Gemini (Google) model for optimization tasks if available
  const optimizationModels = getModelsByTask(ModelTask.OPTIMIZATION_TASKS);
  const taskModel = optimizationModels.find(m => m.engine === ModelEngine.GOOGLE) || optimizationModels[0];
  if (!taskModel) throw new Error('No LLM configured for OPTIMIZATION_TASKS');

  // For the summary, prefer an OpenAI model as requested.
  const summaryModels = getModelsByTask(ModelTask.OPTIMIZATION_TASKS);
  const summaryModel = summaryModels.find(m => m.engine === ModelEngine.OPENAI) || summaryModels[0];
  if (!summaryModel) throw new Error('No LLM configured for AI Visibility Summary generation');

  // Generate tasks only for first report, iteratively requesting ONE at a time to avoid duplicates
  if (isFirstReport || forceTaskGeneration) {
    const createdTasks: z.infer<typeof TaskSchema>[] = [];
    const accumulatedUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    const TARGET_TASK_COUNT = 10;
    const MAX_ATTEMPTS = 30; // safeguard against infinite loops
    let attempts = 0;

    while (createdTasks.length < TARGET_TASK_COUNT && attempts < MAX_ATTEMPTS) {
      attempts++;
      // 1. Replace placeholders in the prompt template
      const finalTaskPrompt = replacePlaceholders(OPTIMIZATION_TASKS_PROMPT, leanTemplateContext);

      // 2. Create the minimal context needed for the model's instructions
      const tasksPayload = {
        disallowedTitles: [...PRESET_TASKS, ...createdTasks].map(t => t.title),
        disallowedIds: [...createdTasks].map(t => t.id),
      };

      const promptWithPayload = `${finalTaskPrompt}\n\n<CONTEXT>${JSON.stringify(tasksPayload)}`;

      const { data: generatedTask, usage } = await generateAndValidate<
        z.infer<typeof TaskSchema>,
        z.infer<typeof TaskSchema>
      >(
        promptWithPayload,
        TaskSchema,
        taskModel,
        ModelTask.OPTIMIZATION_TASKS,
        undefined, // No transform function
        (data: any) => { // Rescue function
          if (data && data.impact_metric === 'averageInclusionRate') {
            data.impact_metric = 'inclusionRate';
          }
          return data;
        }
      );

      // Ensure uniqueness by ID and Title before pushing
      const isDuplicate = createdTasks.some(t => t.id === generatedTask.id || t.title === generatedTask.title);
      if (!isDuplicate) {
        createdTasks.push(generatedTask);
      }
      accumulatedUsage.promptTokens += usage.promptTokens;
      accumulatedUsage.completionTokens += usage.completionTokens;
      accumulatedUsage.totalTokens += usage.totalTokens;

      // Add a small delay to avoid hitting rate limits
      await new Promise(res => setTimeout(res, 250));
    }

    tasks = createdTasks;
    tasksTokenUsage = accumulatedUsage;
  }
  
  // Append universal preset tasks
  if (isFirstReport || forceTaskGeneration) {
    const priorityRank: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
    const selectedPreset = [...PRESET_TASKS].sort((a, b) => {
      if (priorityRank[a.priority] !== priorityRank[b.priority]) return priorityRank[a.priority] - priorityRank[b.priority];
      return a.id.localeCompare(b.id);
    });

    tasks = [...tasks, ...selectedPreset];
  }
  
  // Replace placeholders and call the model to generate the summary.
  const finalSummaryPrompt = replacePlaceholders(SUMMARY_PROMPT, fullTemplateContext);

  const { content: summaryText, usage: summaryUsage } = await generateChatCompletion(
    summaryModel,
    finalSummaryPrompt
  );
  
  if (!summaryText) {
    throw new Error('Failed to generate AI visibility summary text.');
  }
  
  return {
    tasks,
    summary: summaryText,
    tokenUsage: {
      promptTokens: tasksTokenUsage.promptTokens + summaryUsage.promptTokens,
      completionTokens: tasksTokenUsage.completionTokens + summaryUsage.completionTokens,
      totalTokens: tasksTokenUsage.totalTokens + summaryUsage.totalTokens
    }
  };
}

export async function persistOptimizationTasks(
  tasks: z.infer<typeof TaskSchema>[],
  runId: string,
  companyId: string,
  prisma: PrismaClient
): Promise<void> {
  if (tasks.length === 0) return;
  
  // Ensure idempotency by deleting any existing tasks for this run before creating new ones.
  await prisma.visibilityOptimizationTask.deleteMany({
    where: { reportRunId: runId },
  });
  
  // Deduplicate tasks in-memory to prevent unique constraint errors from the model itself
  const seenTaskIds = new Set<string>();
  const uniqueTasks = tasks.filter(task => {
    if (seenTaskIds.has(task.id)) {
      return false;
    } else {
      seenTaskIds.add(task.id);
      return true;
    }
  });

  if (uniqueTasks.length < tasks.length) {
    console.warn(`[Data Integrity] Removed ${tasks.length - uniqueTasks.length} duplicate task(s) for runId: ${runId}`);
  }

  await prisma.visibilityOptimizationTask.createMany({
    data: uniqueTasks.map(task => ({
      taskId: task.id,
      reportRunId: runId,
      companyId,
      title: task.title,
      description: task.description,
      category: task.category,
      priority: task.priority,
      impactMetric: task.impact_metric,
      dependencies: [],
    }))
  });
}

export async function getOptimizationTasks(
  companyId: string,
  prisma: PrismaClient
) {
  // Get the latest tasks for the company
  const latestReport = await prisma.reportRun.findFirst({
    where: { 
      companyId,
      status: 'COMPLETED',
      optimizationTasks: { some: {} }
    },
    include: {
      optimizationTasks: {
        orderBy: { taskId: 'asc' }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
  
  return latestReport?.optimizationTasks || [];
}

export async function toggleTaskCompletion(
  taskId: string,
  reportRunId: string,
  prisma: PrismaClient
) {
  const task = await prisma.visibilityOptimizationTask.findUnique({
    where: { 
      reportRunId_taskId: { reportRunId, taskId }
    }
  });
  
  if (!task) {
    throw new Error(`Task not found: ${taskId}`);
  }
  
  return prisma.visibilityOptimizationTask.update({
    where: { 
      reportRunId_taskId: { reportRunId, taskId }
    },
    data: {
      isCompleted: !task.isCompleted,
      completedAt: !task.isCompleted ? new Date() : null
    }
  });
} 