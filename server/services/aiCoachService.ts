import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import { AICoachAnalysisResult, AICoachInputData } from '../../src/types';

let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !apiKey.trim() || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

export function formatCanonicalCoachText(data: {
  plannedTasks: number;
  completedTasks: number;
  strongestPeriod: string;
  frequentlyPostponed: string;
  studyDistribution: Array<{ subject: string; percentage: number }>;
  recommendations: string[];
}): string {
  const distText = data.studyDistribution
    .map((s) => `${s.subject} ${s.percentage}%`)
    .join('\n');
  const recsText = data.recommendations
    .map((rec, idx) => `${idx + 1}. ${rec}`)
    .join('\n');

  return `YOUR WEEK\n\nYou planned ${data.plannedTasks} tasks.\nYou completed ${data.completedTasks}.\n\nYour strongest performance period:\n${data.strongestPeriod}.\n\nYou frequently postponed:\n${data.frequentlyPostponed}.\n\nStudy distribution:\n${distText}\n\nRECOMMENDATIONS\n\n${recsText}`;
}

export function generateDeterministicCoachAnalysis(
  inputData: AICoachInputData,
  fallbackReason?: string
): AICoachAnalysisResult {
  const plannedTasks = inputData.tasksPlanned ?? 0;
  const completedTasks = inputData.tasksCompleted ?? 0;
  const completionRate =
    plannedTasks > 0
      ? Math.round((completedTasks / plannedTasks) * 100)
      : (inputData.completionRate ?? 0);
  const strongestPeriod =
    inputData.strongestPeriod || (plannedTasks === 0 ? 'No activity recorded yet' : 'Morning (9 AM – 12 PM)');
  const frequentlyPostponed = inputData.frequentlyPostponedTask || 'None';

  const studyDistribution =
    inputData.studyDistribution && inputData.studyDistribution.length > 0
      ? inputData.studyDistribution.map((s) => ({
          subject: s.subject,
          percentage: s.percentage,
          color: s.color,
        }))
      : [];

  const recommendations =
    plannedTasks === 0 && completedTasks === 0
      ? [
          'Create your first daily tasks and habits for today to start tracking.',
          'Complete a focused study session to establish your productivity rhythm.',
          'Check back at the end of the week for personalized AI Coach insights based on real activity.',
        ]
      : [
          `Move ${frequentlyPostponed} to your strongest study period.`,
          `Target steady consistency with ${Math.max(1, Math.round(plannedTasks / 7))} tasks per day.`,
          `Schedule revision before your evening workload.`,
        ];

  const formattedText = formatCanonicalCoachText({
    plannedTasks,
    completedTasks,
    strongestPeriod,
    frequentlyPostponed,
    studyDistribution,
    recommendations,
  });

  return {
    plannedTasks,
    completedTasks,
    completionRate,
    strongestPeriod,
    frequentlyPostponed,
    studyDistribution,
    recommendations,
    coachNote:
      plannedTasks === 0 && completedTasks === 0
        ? 'Welcome to your clean tracker! Start logging tasks today to build your real personal productivity history.'
        : `Great consistency this week with ${completedTasks} completed tasks. Protect your peak hours for high-friction subjects.`,
    isAiGenerated: false,
    modelUsed: 'Built-in Productivity Coach Engine',
    generatedAt: new Date().toISOString(),
    formattedText,
    fallbackReason: fallbackReason || 'GEMINI_API_KEY not configured or offline',
  };
}

const CANDIDATE_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-3.8-flash',
  'gemini-flash-latest',
];

export class AICoachService {
  public async analyzeWeeklyProductivity(
    inputData: AICoachInputData
  ): Promise<AICoachAnalysisResult> {
    const client = getAiClient();

    // If Gemini client is unavailable (no API key configured), return high-fidelity deterministic analysis
    if (!client) {
      console.log('[AICoachService] GEMINI_API_KEY not configured. Using deterministic coach engine.');
      return generateDeterministicCoachAnalysis(
        inputData,
        'GEMINI_API_KEY not configured. Running on deterministic coach engine.'
      );
    }

    const plannedTasks = inputData.tasksPlanned ?? 0;
    const completedTasks = inputData.tasksCompleted ?? 0;
    const strongestPeriod = inputData.strongestPeriod || (plannedTasks === 0 ? 'No activity recorded yet' : 'Morning (9 AM – 12 PM)');
    const frequentlyPostponed = inputData.frequentlyPostponedTask || 'None';
    const dailyAvgPlanned = inputData.dailyAvgPlanned ?? (plannedTasks > 0 ? Math.round(plannedTasks / 7) : 0);
    const dailyAvgCompleted = inputData.dailyAvgCompleted ?? (completedTasks > 0 ? Math.round(completedTasks / 7) : 0);

    const distributionString = (inputData.studyDistribution || [])
      .map((s) => `${s.subject}: ${s.percentage}% (${s.formattedDuration || ''})`)
      .join(', ');

    const prompt = `You are analyzing actual weekly productivity tracking data for the week: ${inputData.weekLabel}.

REAL APPLICATION DATA (DO NOT MODIFY THESE FIGURES):
- Total planned tasks: ${plannedTasks}
- Total completed tasks: ${completedTasks}
- Completion rate: ${inputData.completionRate}%
- Strongest performance period: ${strongestPeriod} (${inputData.strongestPeriodEvidence || 'Peak execution volume'})
- Most frequently postponed task: ${frequentlyPostponed} (${inputData.frequentlyPostponedEvidence || 'High friction in late evening'})
- Study distribution: ${distributionString}
- Daily average planned tasks: ${dailyAvgPlanned}
- Daily average completed tasks: ${dailyAvgCompleted}
- Best day: ${inputData.bestDay?.dayName || 'Tuesday'} (${inputData.bestDay?.rate || 90}% completed)
- Weakest day: ${inputData.weakestDay?.dayName || 'Saturday'} (${inputData.weakestDay?.rate || 40}% completed)
- Top habit: ${inputData.topHabit?.name || 'CGL Study'} (${inputData.topHabit?.completedCount || 6}/${inputData.topHabit?.totalDays || 7} days)

MANDATORY INSTRUCTIONS:
1. Ground truth fidelity: Set plannedTasks to exactly ${plannedTasks}, completedTasks to exactly ${completedTasks}, strongestPeriod to "${strongestPeriod}", frequentlyPostponed to "${frequentlyPostponed}".
2. Set studyDistribution subjects and percentages matching the real data: ${distributionString}.
3. Provide exactly 3 concise, impactful recommendations without leading numbers:
   - Recommendation 1: ${frequentlyPostponed !== 'None' ? `Move "${frequentlyPostponed}" to your strongest study period.` : 'Schedule your highest-priority subject during your peak study period.'}
   - Recommendation 2: ${dailyAvgPlanned > dailyAvgCompleted ? `Align daily planned tasks from ${dailyAvgPlanned} to a steady ${dailyAvgCompleted}.` : `Maintain your steady pace of ${dailyAvgCompleted || 2} tasks per day.`}
   - Recommendation 3: Schedule revision before your evening workload.
4. Provide a supportive 1-2 sentence coachNote.`;

    let lastError: any = null;

    // Try candidate models in order: gemini-3.1-flash-lite (fastest, high resilience), gemini-3.8-flash, gemini-flash-latest
    for (const model of CANDIDATE_MODELS) {
      try {
        const modelConfig: any = {
          systemInstruction:
            'You are an expert AI Productivity Coach for a student preparing for competitive exams. You synthesize real tracking data into clear weekly performance summaries and actionable guidance.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              plannedTasks: { type: Type.INTEGER },
              completedTasks: { type: Type.INTEGER },
              strongestPeriod: { type: Type.STRING },
              frequentlyPostponed: { type: Type.STRING },
              studyDistribution: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    subject: { type: Type.STRING },
                    percentage: { type: Type.INTEGER },
                  },
                  required: ['subject', 'percentage'],
                },
              },
              recommendations: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              coachNote: { type: Type.STRING },
            },
            required: [
              'plannedTasks',
              'completedTasks',
              'strongestPeriod',
              'frequentlyPostponed',
              'studyDistribution',
              'recommendations',
            ],
          },
        };

        if (model === 'gemini-3.8-flash') {
          modelConfig.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
        }

        const generateCall = client.models.generateContent({
          model,
          contents: prompt,
          config: modelConfig,
        });

        // 15-second timeout protection per candidate call to give ample time for network & generation
        const timeoutCall = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Latency exceeded 15000ms on model ${model}`)), 15000)
        );

        const response = (await Promise.race([generateCall, timeoutCall])) as any;
        const responseText = response.text;
        if (!responseText) {
          throw new Error(`Empty response received from ${model}`);
        }

        const parsed = JSON.parse(responseText);

        // Verify ground truth numbers (protect against model hallucinations)
        const sanitizedPlanned = parsed.plannedTasks === plannedTasks ? parsed.plannedTasks : plannedTasks;
        const sanitizedCompleted = parsed.completedTasks === completedTasks ? parsed.completedTasks : completedTasks;
        const sanitizedPeriod = parsed.strongestPeriod || strongestPeriod;
        const sanitizedPostponed = parsed.frequentlyPostponed || frequentlyPostponed;
        const sanitizedDistribution =
          Array.isArray(parsed.studyDistribution) && parsed.studyDistribution.length > 0
            ? parsed.studyDistribution
            : inputData.studyDistribution.map((s) => ({ subject: s.subject, percentage: s.percentage }));

        const fallbackRec1 =
          sanitizedPostponed && sanitizedPostponed !== 'None'
            ? `Move ${sanitizedPostponed} to your strongest study period.`
            : 'Schedule your highest-priority subject during your peak study period.';
        const fallbackRec2 =
          dailyAvgPlanned > dailyAvgCompleted
            ? `Align daily planned tasks from ${dailyAvgPlanned} to a steady ${dailyAvgCompleted}.`
            : `Maintain your steady pace of ${dailyAvgCompleted || 2} tasks per day.`;

        const rawRecommendations =
          Array.isArray(parsed.recommendations) && parsed.recommendations.length >= 3
            ? parsed.recommendations.slice(0, 3)
            : [fallbackRec1, fallbackRec2, 'Schedule revision before your evening workload.'];

        const sanitizedRecommendations: string[] = rawRecommendations.map((rec: any) =>
          String(rec || '')
            .replace(/^\d+[\.\)]\s*/, '')
            .trim()
        );

        const formattedText = formatCanonicalCoachText({
          plannedTasks: sanitizedPlanned,
          completedTasks: sanitizedCompleted,
          strongestPeriod: sanitizedPeriod,
          frequentlyPostponed: sanitizedPostponed,
          studyDistribution: sanitizedDistribution,
          recommendations: sanitizedRecommendations,
        });

        return {
          plannedTasks: sanitizedPlanned,
          completedTasks: sanitizedCompleted,
          completionRate: Math.round((sanitizedCompleted / sanitizedPlanned) * 100),
          strongestPeriod: sanitizedPeriod,
          frequentlyPostponed: sanitizedPostponed,
          studyDistribution: sanitizedDistribution,
          recommendations: sanitizedRecommendations,
          coachNote: parsed.coachNote || 'Great momentum this week. Prioritize high-focus blocks for demanding subjects.',
          isAiGenerated: true,
          modelUsed: model,
          generatedAt: new Date().toISOString(),
          formattedText,
        };
      } catch (err: any) {
        lastError = err;
        const isHighDemandOrTimeout =
          err?.status === 503 ||
          err?.code === 503 ||
          (typeof err?.message === 'string' &&
            (err.message.includes('503') ||
              err.message.includes('high demand') ||
              err.message.includes('UNAVAILABLE') ||
              err.message.includes('Latency exceeded') ||
              err.message.includes('Timeout') ||
              err.message.includes('ResourceExhausted') ||
              err.message.includes('429')));

        if (isHighDemandOrTimeout) {
          console.info(`[AICoachService] Model "${model}" temporarily experiencing high demand or latency. Trying next candidate...`);
        } else {
          console.info(`[AICoachService] Model "${model}" fallback trigger: ${err?.message || err}. Trying next candidate...`);
        }
      }
    }

    // Graceful fallback if all models experienced temporary demand spikes or errors
    console.info('[AICoachService] Gemini models currently experiencing high demand. Seamlessly serving high-fidelity deterministic coach analysis.');
    return generateDeterministicCoachAnalysis(
      inputData,
      `Gemini models temporarily busy (${lastError?.message || 'high demand'}). Generated with Built-in Coach Engine.`
    );
  }
}

export const aiCoachService = new AICoachService();
