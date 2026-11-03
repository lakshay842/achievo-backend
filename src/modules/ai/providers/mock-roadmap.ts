import type { GeneratedRoadmap } from '../../roadmaps/roadmap.validation';

type RoadmapInput = {
  title: string;
  category: string;
  durationDays: number;
  dailyMinutes: number;
  currentLevel?: string;
  desiredOutcome?: string;
  description?: string;
  summary?: string;
};

type DayPlan = {
  title: string;
  instructions: string[];
  completionCriteria: string[];
  priority?: 'low' | 'medium' | 'high';
};

function clampMinutes(value: number) {
  return Math.min(Math.max(value, 15), 90);
}

function topicKey(input: RoadmapInput): string {
  const blob = `${input.title} ${input.description ?? ''} ${input.desiredOutcome ?? ''} ${input.summary ?? ''}`.toLowerCase();
  if (/prompt|promt|llm|chatgpt|gemini|ai writing/.test(blob)) return 'prompt-engineering';
  if (/fitness|run|gym|workout|yoga|strength/.test(blob)) return 'fitness';
  if (/career|job|interview|resume|promotion/.test(blob)) return 'career';
  if (/finance|money|budget|invest|saving/.test(blob)) return 'finance';
  if (/health|sleep|habit|nutrition/.test(blob)) return 'health';
  if (/education|learn|study|course|language|coding|programming/.test(blob) || input.category === 'education') {
    return 'education';
  }
  return input.category || 'personal';
}

function promptEngineeringDays(level: string): DayPlan[] {
  const beginner = /begin|novice|new|start/i.test(level);
  return [
    {
      title: 'Write your first clear prompt',
      instructions: [
        'Pick one real task you want help with (email, study note, or explanation).',
        'Write a prompt with role, goal, audience, and output format.',
        'Run it once and save the prompt + result.',
      ],
      completionCriteria: ['You have a prompt that states role, goal, and format.', 'You saved one output you would actually use.'],
    },
    {
      title: 'Add constraints and examples',
      instructions: [
        'Take yesterday’s prompt and add 2 constraints (length, tone, or must-include points).',
        'Add one short example of a good answer.',
        'Compare the new output with yesterday’s.',
      ],
      completionCriteria: ['Your prompt includes constraints and one example.', 'You can name one improvement in the new output.'],
    },
    {
      title: 'Break a task into prompt steps',
      instructions: [
        'Choose a multi-step task (plan a lesson, outline a post, or debug a problem).',
        'Split it into 3 prompts: research, draft, refine.',
        'Run the chain and keep only the final useful result.',
      ],
      completionCriteria: ['You have a 3-step prompt chain.', 'The final output is more specific than a single prompt attempt.'],
      priority: 'high',
    },
    {
      title: 'Improve weak outputs with critique',
      instructions: [
        'Take a weak AI answer and ask the model to critique it against your criteria.',
        'Ask for a revised version using that critique.',
        'Edit the revision once by hand.',
      ],
      completionCriteria: ['You used a critique-then-revise loop.', 'Your final version includes at least one manual edit.'],
    },
    {
      title: 'Build a reusable prompt template',
      instructions: [
        'Create a template with placeholders like {{topic}}, {{audience}}, and {{format}}.',
        beginner
          ? 'Fill the template for two different topics.'
          : 'Fill the template for two topics and add evaluation checks.',
        'Save the template where you will reuse it.',
      ],
      completionCriteria: ['You have a reusable template with placeholders.', 'You tested it on two different inputs.'],
      priority: 'high',
    },
    {
      title: 'Evaluate prompt quality',
      instructions: [
        'Score two prompts on clarity, specificity, and usefulness (1–5 each).',
        'Rewrite the weaker prompt using what you learned.',
        'Note one rule you will keep for future prompts.',
      ],
      completionCriteria: ['You scored two prompts with reasons.', 'You have one personal prompting rule written down.'],
    },
    {
      title: 'Ship a small prompt workflow',
      instructions: [
        'Combine your best prompts into a mini workflow for one real outcome.',
        'Run the full workflow start to finish.',
        'Write a 5-line recap of what worked and what to change next week.',
      ],
      completionCriteria: ['You completed one end-to-end workflow.', 'You wrote a short recap with one next improvement.'],
      priority: 'high',
    },
  ];
}

function educationDays(title: string, level: string): DayPlan[] {
  const skill = title.trim() || 'your topic';
  return [
    {
      title: `Map what “good at ${skill}” means`,
      instructions: [
        `List 5 concrete skills someone needs for ${skill}.`,
        'Mark which ones you already know vs need to learn.',
        'Pick the one skill that unlocks the most progress this week.',
      ],
      completionCriteria: ['You have a 5-skill map.', 'You chose one focus skill for this week.'],
    },
    {
      title: `Learn one core idea for ${skill}`,
      instructions: [
        'Study one short lesson, chapter, or tutorial on your focus skill.',
        'Write 5 bullet notes in your own words.',
        'Teach the idea out loud for 60 seconds.',
      ],
      completionCriteria: ['You have 5 notes in your own words.', 'You can explain the idea without reading.'],
    },
    {
      title: `Do a tiny practice for ${skill}`,
      instructions: [
        'Complete one small exercise related to the focus skill.',
        'Timebox the work to your daily minutes.',
        'Write what confused you in one sentence.',
      ],
      completionCriteria: ['You finished one practice exercise.', 'You logged one confusion to fix tomorrow.'],
      priority: 'high',
    },
    {
      title: 'Fix yesterday’s confusion',
      instructions: [
        'Revisit the confusing part with a better example or second source.',
        'Redo a smaller version of the practice.',
        'Note the corrected understanding in 3 bullets.',
      ],
      completionCriteria: ['You resolved or narrowed the confusion.', 'You completed a corrected practice attempt.'],
    },
    {
      title: 'Apply it to a real mini-project',
      instructions: [
        `Start a tiny project that uses ${skill} for a real outcome.`,
        'Define done in one sentence.',
        'Work only toward that definition of done.',
      ],
      completionCriteria: ['You have a mini-project with a clear done line.', 'You made visible progress on it.'],
      priority: 'high',
    },
    {
      title: 'Review and tighten',
      instructions: [
        'Review your notes and project against your done line.',
        'Remove one unnecessary step and improve one weak part.',
        level && /advanced|expert/i.test(level)
          ? 'Add one harder variation of the exercise.'
          : 'Repeat the easiest successful exercise once for fluency.',
      ],
      completionCriteria: ['You improved one weak part of the work.', 'You know what “better” looked like today.'],
    },
    {
      title: 'Demonstrate weekly progress',
      instructions: [
        'Produce a short demo: summary, sample, or walkthrough of what you can do now.',
        'List 3 things you can do that you could not do on day 1.',
        'Choose next week’s focus skill.',
      ],
      completionCriteria: ['You created a short demo of progress.', 'You listed 3 new capabilities and a next focus.'],
      priority: 'high',
    },
  ];
}

function fitnessDays(title: string): DayPlan[] {
  return [
    {
      title: 'Baseline movement check',
      instructions: ['Do a gentle warm-up.', 'Record a simple baseline (walk time, reps, or mobility).', 'Stop while form still feels good.'],
      completionCriteria: ['You logged a baseline number.', 'You finished without pain.'],
    },
    {
      title: 'Build the main pattern',
      instructions: ['Practice the main movement pattern for your goal.', 'Use easy effort and clean form.', 'Write one cue that helped.'],
      completionCriteria: ['You completed the main pattern set.', 'You have one form cue written down.'],
      priority: 'high',
    },
    {
      title: 'Add controlled volume',
      instructions: ['Repeat yesterday’s pattern with one extra easy set.', 'Keep rest honest.', 'Note energy after the session.'],
      completionCriteria: ['You completed the planned sets.', 'You logged energy 1–5.'],
    },
    {
      title: 'Recovery and mobility',
      instructions: ['Do mobility for the areas that felt tight.', 'Walk or move easily for most of the session.', 'Hydrate and note sleep target tonight.'],
      completionCriteria: ['You completed a recovery session.', 'You set a sleep target for tonight.'],
    },
    {
      title: 'Slightly harder session',
      instructions: ['Increase difficulty a little (pace, load, or rounds).', 'Keep form above ego.', 'Stop 1–2 reps before form breaks.'],
      completionCriteria: ['You completed a harder session with good form.', 'You know what to repeat next time.'],
      priority: 'high',
    },
    {
      title: 'Skill + consistency check',
      instructions: ['Combine warm-up, main work, and a short finisher.', 'Compare to day 1 baseline.', 'Adjust next week’s target by 5–10%.'],
      completionCriteria: ['You finished a full short workout.', 'You set a realistic next-week target.'],
    },
    {
      title: `${title} weekly wrap`,
      instructions: ['Repeat your best session of the week at easy effort.', 'Write what improved.', 'Plan the next 3 sessions.'],
      completionCriteria: ['You completed the wrap session.', 'You have next week’s 3-session outline.'],
      priority: 'high',
    },
  ];
}

function genericDays(title: string): DayPlan[] {
  const goal = title.trim() || 'your goal';
  return [
    {
      title: `Clarify the next win for ${goal}`,
      instructions: [`Write what progress on ${goal} looks like in 7 days.`, 'Pick one action you can finish today.', 'Remove one distraction for this session.'],
      completionCriteria: ['You defined a 7-day win.', 'You finished one concrete action today.'],
    },
    {
      title: 'Do the smallest useful version',
      instructions: ['Break today’s work into 3 tiny steps.', 'Complete all three inside your time box.', 'Capture one lesson.'],
      completionCriteria: ['All 3 tiny steps are done.', 'You wrote one lesson from the session.'],
      priority: 'high',
    },
    {
      title: 'Deepen the same skill',
      instructions: ['Repeat yesterday’s action with one improvement.', 'Keep scope small.', 'Compare quality before vs after.'],
      completionCriteria: ['You improved one part of yesterday’s work.', 'You can describe the improvement in one sentence.'],
    },
    {
      title: 'Get feedback or a reference',
      instructions: ['Compare your work to a good example or ask for feedback.', 'List 2 gaps.', 'Fix the easier gap now.'],
      completionCriteria: ['You identified 2 gaps.', 'You fixed one gap in this session.'],
    },
    {
      title: 'Make it real-world',
      instructions: ['Apply the skill to a real situation in your life or work.', 'Ship a rough version.', 'Note what still blocks you.'],
      completionCriteria: ['You produced a real-world draft/result.', 'You named the remaining blocker.'],
      priority: 'high',
    },
    {
      title: 'Reduce friction',
      instructions: ['Create a checklist or template so tomorrow is easier.', 'Prep materials in advance.', 'Do one rehearsal.'],
      completionCriteria: ['You have a reusable checklist/template.', 'Tomorrow’s first step is prepared.'],
    },
    {
      title: 'Weekly proof of progress',
      instructions: ['Show evidence of what changed since day 1.', 'Rate confidence 1–10.', 'Choose next week’s single focus.'],
      completionCriteria: ['You have visible proof of progress.', 'You chose one focus for next week.'],
      priority: 'high',
    },
  ];
}

function dayBank(input: RoadmapInput): DayPlan[] {
  const key = topicKey(input);
  const level = input.currentLevel ?? '';
  if (key === 'prompt-engineering') return promptEngineeringDays(level);
  if (key === 'fitness') return fitnessDays(input.title);
  if (key === 'education') return educationDays(input.title, level);
  return genericDays(input.title);
}

function milestoneTitle(input: RoadmapInput, index: number, start: number, end: number): string {
  const key = topicKey(input);
  if (key === 'prompt-engineering') {
    const labels = ['Prompt foundations', 'Prompt systems', 'Prompt mastery sprint'];
    return labels[Math.min(index, labels.length - 1)]!;
  }
  if (key === 'education') {
    return `Skill block ${index + 1}: ${input.title}`;
  }
  return `${input.title} · days ${start}–${end}`;
}

export function buildMockRoadmap(input: RoadmapInput): GeneratedRoadmap {
  const durationDays = input.durationDays;
  const milestoneSize = 7;
  const milestoneCount = Math.ceil(durationDays / milestoneSize);
  const taskMinutes = clampMinutes(input.dailyMinutes);
  const bank = dayBank(input);

  const milestones = Array.from({ length: milestoneCount }, (_, index) => {
    const start = index * milestoneSize + 1;
    const end = Math.min(durationDays, (index + 1) * milestoneSize);
    const tasks = [];
    for (let day = start; day <= end; day += 1) {
      const template = bank[(day - 1) % bank.length]!;
      tasks.push({
        day,
        title: template.title,
        durationMinutes: taskMinutes,
        priority: template.priority ?? (day % 5 === 0 ? ('high' as const) : ('medium' as const)),
        instructions: template.instructions,
        completionCriteria: template.completionCriteria,
      });
    }
    return {
      title: milestoneTitle(input, index, start, end),
      sequence: index + 1,
      description: `Focused work for days ${start}–${end} toward ${input.desiredOutcome || input.title}.`,
      tasks,
    };
  });

  return {
    goal: {
      title: input.title,
      durationDays,
      category: input.category || 'personal',
    },
    milestones,
  };
}
