import { Worker, Job } from 'bullmq';
import env from '../config/env';
import prisma from '../config/db';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

const generateQuestions = (industry: string | null) => {
    // In a real implementation, this would use GPT-4.1 and be cached in Redis.
    // For now, we'll use a hardcoded list of generic questions.
    console.log(`Generating questions for industry: ${industry || 'General'}`);
    return [
        "What are the primary strengths of this company's current marketing strategy?",
        "What are the most significant weaknesses or gaps in their marketing?",
        "Who are the key target audience segments for this company?",
        "How does the company's website and branding compare to its main competitors?",
        "What is the overall sentiment surrounding the brand online?",
        "What are 3 actionable recommendations for improving their SEO?",
        "What content marketing opportunities are they missing?",
        "How effective is their social media presence?",
    ];
};

const processJob = async (job: Job) => {
    const { runId } = job.data;
    const reportRun = await prisma.reportRun.findUnique({
        where: { id: runId },
        include: { company: true },
    });

    if (!reportRun) {
        throw new Error(`ReportRun with id ${runId} not found.`);
    }

    if (reportRun.status === 'COMPLETED') {
        console.log(`Report ${runId} is already completed. Skipping.`);
        return;
    }

    try {
        await prisma.reportRun.update({
            where: { id: runId },
            data: { status: 'RUNNING' },
        });

        // --- Step 1: Question Generation ---
        await prisma.reportRun.update({ where: { id: runId }, data: { stepStatus: 'GENERATING_QUESTIONS' } });
        const questionsText = generateQuestions(reportRun.company.industry);
        const questions = await prisma.question.createMany({
            data: questionsText.map(q => ({ runId, text: q })),
        });
        console.log(`[Worker] Step 1: Generated ${questions.count} questions for runId: ${runId}`);


        // --- Step 2: Answer Fetching ---
        await prisma.reportRun.update({ where: { id: runId }, data: { stepStatus: 'FETCHING_ANSWERS' } });
        const generatedQuestions = await prisma.question.findMany({ where: { runId } });
        let allAnswersText = '';

        for (const question of generatedQuestions) {
            // In a real implementation, this would use multiple engines and have rate limiting.
            const prompt = `As a world-class marketing analyst, answer the following question about the company '${reportRun.company.name}' whose website is ${reportRun.company.website}. Question: ${question.text}`;
            
            const completion = await openai.chat.completions.create({
                model: 'gpt-4.1',
                messages: [{ role: 'user', content: prompt }],
            });

            const answerText = completion.choices[0].message.content || "No answer generated.";
            allAnswersText += answerText + "\n\n";

            await prisma.answer.create({
                data: {
                    runId,
                    questionId: question.id,
                    questionText: question.text,
                    answerText,
                    engine: 'gpt-4.1',
                }
            });
        }
        console.log(`[Worker] Step 2: Fetched answers for ${generatedQuestions.length} questions.`);

        // --- Step 3: Metric Calculation ---
        await prisma.reportRun.update({ where: { id: runId }, data: { stepStatus: 'CALCULATING_METRICS' } });
        
        // Simplified sentiment analysis metric
        const sentimentPrompt = `Based on the following analysis, what is the overall sentiment of the company's marketing presence? Please respond with a single number between 1 (very negative) and 10 (very positive).\n\n${allAnswersText}`;
        const sentimentCompletion = await openai.chat.completions.create({
            model: 'gpt-4.1',
            messages: [{ role: 'user', content: sentimentPrompt }],
        });
        const sentimentScore = parseInt(sentimentCompletion.choices[0].message.content || '5', 10);

        await prisma.metric.create({
            data: {
                runId,
                name: 'Overall Sentiment',
                value: { score: sentimentScore },
            }
        });
        // In a real implementation, PAWC, Competitor SoV, etc. would be calculated here.
        console.log(`[Worker] Step 3: Calculated sentiment metric.`);

        // --- Finalization ---
        // Aggregate all data into a single JSON object for the final report
        const finalReportData = {
            company: {
                name: reportRun.company.name,
                website: reportRun.company.website,
                industry: reportRun.company.industry,
            },
            analysis: await prisma.answer.findMany({ 
                where: { runId },
                select: { questionText: true, answerText: true, engine: true }
            }),
            metrics: await prisma.metric.findMany({
                where: { runId },
                select: { name: true, value: true }
            }),
        };

        // Create the final, consolidated report
        await prisma.report.create({
            data: {
                runId,
                companyId: reportRun.companyId,
                status: 'COMPLETED',
                data: finalReportData,
            }
        });

        await prisma.reportRun.update({
            where: { id: runId },
            data: { status: 'COMPLETED', stepStatus: 'FINISHED' },
        });

        console.log(`Finished processing report for runId: ${runId}`);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Failed to process report for runId: ${runId}`, { error: errorMessage });
        
        // Also create a failed report record for traceability
        await prisma.report.create({
            data: {
                runId,
                companyId: job.data.companyId,
                status: 'FAILED',
            }
        });
        
        await prisma.reportRun.update({
            where: { id: runId },
            data: { 
                status: 'FAILED',
                stepStatus: `FAILED: ${errorMessage.substring(0, 250)}`
            },
        });

        throw error; // Re-throw to let BullMQ handle the retry logic
    }
}

const worker = new Worker('report-generation', processJob, {
  connection: {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
  },
  concurrency: 5,
  removeOnComplete: { count: 1000 },
  removeOnFail: { count: 5000 },
});

worker.on('completed', (job: Job) => {
  console.log(`Job ${job.id} has completed successfully.`);
});

worker.on('failed', (job: Job | undefined, err: Error) => {
  if (job) {
    console.error(`Job ${job.id} has failed after ${job.attemptsMade} attempts with ${err.message}`);
  } else {
    console.error(`A job has failed with ${err.message}`);
  }
});

console.log('Report worker process started...');

export default worker; 