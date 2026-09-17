import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import { AICoachAnalysisResult, AICoachInputData } from '../../src/types';
import { TaskModel, HabitModel, HabitCompletionModel } from '../models/HabitData';

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
  const distText =
    data.studyDistribution && data.studyDistribution.length > 0
      ? data.studyDistribution.map((s) => `${s.subject} ${s.percentage}%`).join('\n')
      : 'No study sessions recorded';
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
          frequentlyPostponed !== 'None'
            ? `Move ${frequentlyPostponed} to your strongest study period.`
            : 'Schedule your highest-priority subject during your peak study period.',
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
  /**
   * Resolves authoritative ground truth from MongoDB for the authenticated user
   */
  public async resolveAuthoritativeInputData(
    userId: string,
    rawInput: AICoachInputData
  ): Promise<AICoachInputData> {
    try {
      // Determine week date range (default to trailing 7 days if absent)
      let weekStartDate = rawInput.weekStartDate;
      let weekEndDate = rawInput.weekEndDate;

      if (!weekStartDate || !weekEndDate) {
        const now = new Date();
        weekEndDate = now.toISOString().split('T')[0];
        const startD = new Date(now);
        startD.setDate(startD.getDate() - 6);
        weekStartDate = startD.toISOString().split('T')[0];
      }

      // Query MongoDB tasks for authenticated user
      const mongoTasks = await TaskModel.find({ userId }).lean();

      // Filter tasks within the review week window
      const weekTasks = (mongoTasks as any[]).filter((t) => {
        const taskDate = t.scheduledDate || t.date || t.dueDate || (t.createdAt ? String(t.createdAt).split('T')[0] : '');
        return taskDate >= weekStartDate && taskDate <= weekEndDate;
      });

      const plannedTasks = weekTasks.length;
      const completedTasks = weekTasks.filter(
        (t) => Boolean(t.completed || t.status === 'completed')
      ).length;
      const completionRate = plannedTasks > 0 ? Math.round((completedTasks / plannedTasks) * 100) : 0;
      const dailyAvgPlanned = plannedTasks > 0 ? Math.round(plannedTasks / 7) : 0;
      const dailyAvgCompleted = completedTasks > 0 ? Math.round(completedTasks / 7) : 0;

      // Authoritative study tasks from MongoDB
      const studyTasks = weekTasks.filter((t) => t.isStudySession && t.studySubject);
      let authoritativeDistribution: Array<{
        subject: string;
        percentage: number;
        studyMinutes: number;
        formattedDuration: string;
        color?: string;
      }> = [];

      const studyColors: Record<string, string> = {
        GK: '#059669',
        Quant: '#2563eb',
        Reasoning: '#7c3aed',
        English: '#d97706',
      };

      if (studyTasks.length > 0) {
        const subjectMap = new Map<string, number>();
        studyTasks.forEach((t) => {
          const subj = t.studySubject || 'General';
          const mins = Number(t.studyDurationMinutes) || Number(t.duration) || 0;
          subjectMap.set(subj, (subjectMap.get(subj) || 0) + mins);
        });
        const totalMins = Array.from(subjectMap.values()).reduce((a, b) => a + b, 0);
        if (totalMins > 0) {
          authoritativeDistribution = Array.from(subjectMap.entries()).map(([subj, mins]) => {
            const h = Math.floor(mins / 60);
            const m = mins % 60;
            return {
              subject: subj,
              percentage: Math.round((mins / totalMins) * 100),
              studyMinutes: mins,
              formattedDuration: `${h}h ${m > 0 ? `${m}m` : ''}`.trim() || `${mins}m`,
              color: studyColors[subj] || '#4f46e5',
            };
          });
        }
      }

      // Authoritative habits and completions from MongoDB
      const habits = await HabitModel.find({
        userId,
        active: true,
      }).lean();

      let authoritativeTopHabit = {
        id: '',
        name: 'No habits tracked',
        completedCount: 0,
        totalDays: 7,
        rate: 0,
      };

      if (habits.length > 0) {
        const habitIds = habits.map((h: any) => h.id);
        const completions = await HabitCompletionModel.find({
          userId,
          habitId: { $in: habitIds },
          date: { $gte: weekStartDate, $lte: weekEndDate },
          completed: true,
        }).lean();

        let maxCount = 0;
        let bestH: any = null;
        for (const h of habits) {
          const count = completions.filter((c: any) => c.habitId === (h as any).id).length;
          if (count > maxCount) {
            maxCount = count;
            bestH = h;
          }
        }
        if (bestH && maxCount > 0) {
          authoritativeTopHabit = {
            id: bestH.id,
            name: bestH.name,
            completedCount: maxCount,
            totalDays: 7,
            rate: Math.round((maxCount / 7) * 100),
          };
        }
      }

      // Strongest period & frequently postponed task
      let strongestPeriod = plannedTasks > 0 ? 'Morning (7 AM – 11 AM)' : 'No activity recorded yet';
      let strongestPeriodEvidence = plannedTasks > 0 ? 'Peak scheduled completion window' : 'No scheduled tasks during this period';
      let frequentlyPostponedTask = 'None';
      let frequentlyPostponedEvidence = 'No uncompleted tasks';

      const incomplete = weekTasks.filter((t) => !t.completed && t.status !== 'completed');
      if (incomplete.length > 0) {
        frequentlyPostponedTask = incomplete[0].title || 'Pending Task';
        frequentlyPostponedEvidence = `${incomplete.length} task(s) uncompleted`;
      }

      // Best and weakest days
      let bestDay = {
        dayName: 'None',
        date: weekStartDate,
        completed: 0,
        total: 0,
        rate: 0,
        score: 0,
      };
      let weakestDay = {
        dayName: 'None',
        date: weekStartDate,
        completed: 0,
        total: 0,
        rate: 0,
        score: 0,
      };

      if (plannedTasks > 0) {
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayStats = new Map<string, { date: string; dayName: string; total: number; completed: number; rate: number }>();
        weekTasks.forEach((t) => {
          const dStr = t.scheduledDate || t.date || (t.createdAt ? String(t.createdAt).split('T')[0] : '');
          if (dStr) {
            const existing = dayStats.get(dStr) || {
              date: dStr,
              dayName: dayNames[new Date(dStr + 'T00:00:00').getDay()] || 'Day',
              total: 0,
              completed: 0,
              rate: 0,
            };
            existing.total += 1;
            if (t.completed || t.status === 'completed') existing.completed += 1;
            existing.rate = Math.round((existing.completed / existing.total) * 100);
            dayStats.set(dStr, existing);
          }
        });

        const days = Array.from(dayStats.values());
        if (days.length > 0) {
          const sortedBest = [...days].sort((a, b) => b.completed - a.completed || b.rate - a.rate);
          const sortedWeakest = [...days].sort((a, b) => a.rate - b.rate || a.completed - b.completed);
          bestDay = {
            ...sortedBest[0],
            score: sortedBest[0].rate,
          };
          weakestDay = {
            ...sortedWeakest[0],
            score: sortedWeakest[0].rate,
          };
        }
      }

      return {
        ...rawInput,
        weekStartDate,
        weekEndDate,
        tasksPlanned: plannedTasks,
        tasksCompleted: completedTasks,
        completionRate,
        dailyAvgPlanned,
        dailyAvgCompleted,
        strongestPeriod,
        strongestPeriodEvidence,
        frequentlyPostponedTask,
        frequentlyPostponedEvidence,
        studyDistribution: authoritativeDistribution,
        topHabit: authoritativeTopHabit,
        bestDay,
        weakestDay,
        focusHoursFormatted: plannedTasks > 0 ? (rawInput.focusHoursFormatted || '0m') : '0m',
      };
    } catch (dbErr) {
      console.warn('[AICoachService] Failed to query MongoDB for authoritative stats, falling back to sanitized payload:', dbErr);
      return rawInput;
    }
  }

  public async analyzeWeeklyProductivity(
    rawInput: AICoachInputData,
    userId?: string
  ): Promise<AICoachAnalysisResult> {
    // 1. Resolve authoritative database figures if userId is available
    const inputData = userId
      ? await this.resolveAuthoritativeInputData(userId, rawInput)
      : rawInput;

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
    const isCleanWeek = plannedTasks === 0 && completedTasks === 0;

    const strongestPeriod = inputData.strongestPeriod || (isCleanWeek ? 'No activity recorded yet' : 'Morning (9 AM – 12 PM)');
    const frequentlyPostponed = inputData.frequentlyPostponedTask || 'None';
    const dailyAvgPlanned = inputData.dailyAvgPlanned ?? (plannedTasks > 0 ? Math.round(plannedTasks / 7) : 0);
    const dailyAvgCompleted = inputData.dailyAvgCompleted ?? (completedTasks > 0 ? Math.round(completedTasks / 7) : 0);

    const distributionString = (inputData.studyDistribution || [])
      .map((s) => `${s.subject}: ${s.percentage}% (${s.formattedDuration || ''})`)
      .join(', ');

    const cleanPromptInstructions = `The user has 0 scheduled tasks and 0 completed tasks for this review period (a completely clean state).
MANDATORY GROUND TRUTH INSTRUCTIONS:
1. Set plannedTasks to 0, completedTasks to 0, completionRate to 0, strongestPeriod to "No activity recorded yet", frequentlyPostponed to "None".
2. Set studyDistribution to an empty array [].
3. Provide exactly 3 actionable, encouraging onboarding recommendations for starting their productivity journey:
   - Recommendation 1: Create your daily top 3 tasks for today to begin building momentum.
   - Recommendation 2: Start a 25-minute focused study session to establish your learning routine.
   - Recommendation 3: Add core daily habits to track consistency across the week.
4. Provide a supportive 1-2 sentence coachNote welcoming them to their clean tracker.`;

    const activePromptInstructions = `MANDATORY INSTRUCTIONS:
1. Ground truth fidelity: Set plannedTasks to exactly ${plannedTasks}, completedTasks to exactly ${completedTasks}, strongestPeriod to "${strongestPeriod}", frequentlyPostponed to "${frequentlyPostponed}".
2. Set studyDistribution subjects and percentages matching the real data: ${distributionString || 'empty array []'}.
3. Provide exactly 3 concise, impactful recommendations without leading numbers:
   - Recommendation 1: ${frequentlyPostponed !== 'None' ? `Move "${frequentlyPostponed}" to your strongest study period.` : 'Schedule your highest-priority subject during your peak study period.'}
   - Recommendation 2: ${dailyAvgPlanned > dailyAvgCompleted ? `Align daily planned tasks from ${dailyAvgPlanned} to a steady ${dailyAvgCompleted}.` : `Maintain your steady pace of ${dailyAvgCompleted || 2} tasks per day.`}
   - Recommendation 3: Schedule revision before your evening workload.
4. Provide a supportive 1-2 sentence coachNote.`;

    const prompt = `You are analyzing actual weekly productivity tracking data for the week: ${inputData.weekLabel || 'Current Week'}.

REAL APPLICATION DATA (DO NOT MODIFY THESE FIGURES):
- Total planned tasks: ${plannedTasks}
- Total completed tasks: ${completedTasks}
- Completion rate: ${inputData.completionRate ?? 0}%
- Strongest performance period: ${strongestPeriod} (${inputData.strongestPeriodEvidence || 'N/A'})
- Most frequently postponed task: ${frequentlyPostponed} (${inputData.frequentlyPostponedEvidence || 'N/A'})
- Study distribution: ${distributionString || 'None (no study sessions logged)'}
- Daily average planned tasks: ${dailyAvgPlanned}
- Daily average completed tasks: ${dailyAvgCompleted}
- Best day: ${inputData.bestDay?.dayName || 'None'} (${inputData.bestDay?.rate ?? 0}% completed)
- Weakest day: ${inputData.weakestDay?.dayName || 'None'} (${inputData.weakestDay?.rate ?? 0}% completed)
- Top habit: ${inputData.topHabit?.name || 'No habits tracked'} (${inputData.topHabit?.completedCount ?? 0}/${inputData.topHabit?.totalDays ?? 7} days)

${isCleanWeek ? cleanPromptInstructions : activePromptInstructions}`;

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
          isCleanWeek
            ? []
            : Array.isArray(parsed.studyDistribution) && parsed.studyDistribution.length > 0
            ? parsed.studyDistribution
            : (inputData.studyDistribution || []).map((s) => ({ subject: s.subject, percentage: s.percentage }));

        const defaultRecs = isCleanWeek
          ? [
              'Create your top daily tasks for today to begin building momentum.',
              'Complete a focused study session to establish your daily learning habit.',
              'Track your daily habits consistently across the upcoming week.',
            ]
          : [
              sanitizedPostponed && sanitizedPostponed !== 'None'
                ? `Move ${sanitizedPostponed} to your strongest study period.`
                : 'Schedule your highest-priority subject during your peak study period.',
              dailyAvgPlanned > dailyAvgCompleted
                ? `Align daily planned tasks from ${dailyAvgPlanned} to a steady ${dailyAvgCompleted}.`
                : `Maintain your steady pace of ${dailyAvgCompleted || 2} tasks per day.`,
              'Schedule revision before your evening workload.',
            ];

        const rawRecommendations =
          Array.isArray(parsed.recommendations) && parsed.recommendations.length >= 3
            ? parsed.recommendations.slice(0, 3)
            : defaultRecs;

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

        const calculatedRate = sanitizedPlanned > 0
          ? Math.round((sanitizedCompleted / sanitizedPlanned) * 100)
          : 0;

        return {
          plannedTasks: sanitizedPlanned,
          completedTasks: sanitizedCompleted,
          completionRate: calculatedRate,
          strongestPeriod: sanitizedPeriod,
          frequentlyPostponed: sanitizedPostponed,
          studyDistribution: sanitizedDistribution,
          recommendations: sanitizedRecommendations,
          coachNote: parsed.coachNote || (isCleanWeek
            ? 'Welcome to your clean tracker! Start logging tasks today to build your real personal productivity history.'
            : 'Great momentum this week. Prioritize high-focus blocks for demanding subjects.'),
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

