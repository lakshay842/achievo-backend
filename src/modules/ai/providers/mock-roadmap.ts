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

type TopicKey =
  | 'quit-smoking'
  | 'quit-gambling'
  | 'quit-habit'
  | 'coding'
  | 'prompt-engineering'
  | 'fitness'
  | 'career'
  | 'finance'
  | 'education'
  | 'personal';

function clampMinutes(value: number) {
  return Math.min(Math.max(value, 15), 90);
}

function blobOf(input: RoadmapInput): string {
  return `${input.title} ${input.description ?? ''} ${input.desiredOutcome ?? ''} ${input.summary ?? ''}`.toLowerCase();
}

function topicKey(input: RoadmapInput): TopicKey {
  const blob = blobOf(input);
  const wantsQuit = /\b(quit|stop|give\s*up|giving\s*up|break|avoid|no\s*more|chodna|chod)\b/.test(blob);
  if (wantsQuit && /\b(smok\w*|cigar\w*|vape\w*|nicotine|tobacco)\b/.test(blob)) {
    return 'quit-smoking';
  }
  if (wantsQuit && /\b(gambl\w*|betting|casino|poker|wager\w*)\b/.test(blob)) {
    return 'quit-gambling';
  }
  if (wantsQuit && /\b(alcohol|drink\w*|porn|sugar|junk\s*food|social\s*media|scrolling|caffeine)\b/.test(blob)) {
    return 'quit-habit';
  }
  if (/prompt|promt|llm|chatgpt|gemini|ai writing/.test(blob)) return 'prompt-engineering';
  if (
    /\b(cod(e|ing)?|program|java|javascript|typescript|python|react|node|dsa|algorithm|software|web.?dev|html|css)\b/.test(
      blob,
    )
  ) {
    return 'coding';
  }
  if (/fitness|run|gym|workout|yoga|strength|weight.?loss/.test(blob)) return 'fitness';
  if (/career|job|interview|resume|promotion|portfolio/.test(blob)) return 'career';
  if (/finance|money|budget|invest|saving|debt/.test(blob)) return 'finance';
  if (/education|learn|study|course|language|exam|skill/.test(blob) || input.category === 'education') {
    return 'education';
  }
  return input.category === 'fitness'
    ? 'fitness'
    : input.category === 'career'
      ? 'career'
      : input.category === 'finance'
        ? 'finance'
        : input.category === 'education'
          ? 'education'
          : 'personal';
}

function skillLabel(input: RoadmapInput): string {
  const title = input.title.trim() || 'your goal';
  return title.length > 48 ? `${title.slice(0, 45)}…` : title;
}

function quitSmokingDays(): DayPlan[] {
  return [
    {
      title: 'Map your smoking triggers',
      instructions: [
        'List when/where you usually smoke (time, place, mood, people).',
        'Circle your top 3 triggers for the next 7 days.',
        'Write one if-then plan for each top trigger.',
      ],
      completionCriteria: ['You have a trigger list with top 3 marked.', 'You wrote 3 if-then plans.'],
      priority: 'high',
    },
    {
      title: 'Build a 5-minute urge toolkit',
      instructions: [
        'Pick 3 urge tools: drink water, walk, message a friend, chew gum, or deep breaths.',
        'Practice one tool for a full 5 minutes today.',
        'Save the toolkit note on your phone home screen.',
      ],
      completionCriteria: ['Toolkit of 3 tools is written.', 'You practiced one tool for 5 minutes.'],
    },
    {
      title: 'Clean your smoking environment',
      instructions: [
        'Remove ashtrays, lighters, and visible cigarettes from your main spaces.',
        'Put a replacement item where cigarettes used to sit (gum, water bottle, stress ball).',
        'Tell one person you are quitting this week.',
      ],
      completionCriteria: ['Visible smoking cues are removed from one main space.', 'A replacement item is in place.'],
      priority: 'high',
    },
    {
      title: 'Delay the first urge by 10 minutes',
      instructions: [
        'When an urge hits, start a 10-minute timer before acting.',
        'Use one toolkit action during the wait.',
        'Log whether the urge dropped, stayed, or you smoked.',
      ],
      completionCriteria: ['You delayed at least one urge by 10 minutes.', 'You logged the urge outcome.'],
    },
    {
      title: 'Design a craving replacement routine',
      instructions: [
        'Choose a 3-step replacement for after meals/tea/coffee (e.g. rinse mouth → walk → gum).',
        'Rehearse the routine once without a craving.',
        'Use it at the next high-risk moment today.',
      ],
      completionCriteria: ['You have a written 3-step replacement.', 'You used it once today.'],
      priority: 'high',
    },
    {
      title: 'Protect your streak window',
      instructions: [
        'Identify the hardest 2-hour window of your day.',
        'Pre-plan activity + snack + no-idle rule for that window.',
        'Complete the window without buying cigarettes.',
      ],
      completionCriteria: ['Hardest window is named.', 'You got through it with your plan.'],
    },
    {
      title: 'Smoke-free proof + next week focus',
      instructions: [
        'Count smoke-free hours/days so far and write what helped most.',
        'List 2 situations that still feel risky.',
        'Choose one focus for next week (mornings, social, stress, or night).',
      ],
      completionCriteria: ['You logged smoke-free progress.', 'You chose one next-week focus.'],
      priority: 'high',
    },
    {
      title: 'Handle a social or stress trigger',
      instructions: [
        'Pick one likely social/stress situation this week.',
        'Write an exit line and a replacement action beforehand.',
        'Practice the line out loud once.',
      ],
      completionCriteria: ['Exit line + replacement action are written.', 'You practiced the line once.'],
    },
    {
      title: 'Reward a clean day without cigarettes',
      instructions: [
        'Define a small non-cigarette reward for a clean day.',
        'Complete today’s high-risk window using your toolkit.',
        'Give yourself the reward only if you stayed smoke-free in that window.',
      ],
      completionCriteria: ['Reward is defined.', 'You earned or honestly skipped it based on the window.'],
    },
    {
      title: 'Reset after a slip (no shame plan)',
      instructions: [
        'Write a 4-line slip plan: what happened, trigger, next action in 10 minutes, restart time.',
        'If you slipped, use the plan immediately; if not, rehearse it.',
        'Remove one remaining cue that contributed.',
      ],
      completionCriteria: ['Slip plan is written.', 'One cue was removed or rehearsed against.'],
      priority: 'high',
    },
  ];
}

function quitGamblingDays(): DayPlan[] {
  return [
    {
      title: 'Block easy access to betting',
      instructions: [
        'List every app/site/wallet you use for gambling.',
        'Delete or log out of one high-risk app/site today.',
        'Move gambling money out of easy reach (transfer or ask someone to hold it).',
      ],
      completionCriteria: ['You listed access points.', 'You blocked or logged out of at least one.'],
      priority: 'high',
    },
    {
      title: 'Map gambling triggers and moods',
      instructions: [
        'Write when urges hit (boredom, stress, payday, ads, friends).',
        'Rank your top 3 triggers.',
        'Write an if-then plan for each.',
      ],
      completionCriteria: ['Top 3 triggers are ranked.', '3 if-then plans exist.'],
    },
    {
      title: 'Create a 15-minute urge delay protocol',
      instructions: [
        'When urge appears: timer 15 minutes + leave the betting screen.',
        'Do one replacement: walk, call someone, cold water, or a short game.',
        'Log urge strength before and after (1–10).',
      ],
      completionCriteria: ['You ran the delay protocol once.', 'Before/after urge scores are logged.'],
      priority: 'high',
    },
    {
      title: 'Replace the dopamine hit',
      instructions: [
        'Choose 2 healthy high-dopamine alternatives (gym sprint, competitive game, cold shower, music practice).',
        'Do one alternative for your full daily minutes.',
        'Note how your body felt after.',
      ],
      completionCriteria: ['Two alternatives are listed.', 'You completed one today.'],
    },
    {
      title: 'Money friction setup',
      instructions: [
        'Turn on spending limits/alerts if available.',
        'Remove saved cards from betting apps if any remain.',
        'Write a daily cash/spend cap that protects essentials.',
      ],
      completionCriteria: ['At least one money friction step is done.', 'Daily spend cap is written.'],
      priority: 'high',
    },
    {
      title: 'Accountability check-in',
      instructions: [
        'Tell one trusted person your no-bet goal for this week.',
        'Agree on a daily yes/no check message.',
        'Send today’s check message.',
      ],
      completionCriteria: ['Accountability person is chosen.', 'Today’s check message was sent or scheduled.'],
    },
    {
      title: 'Design a payday / high-risk plan',
      instructions: [
        'Identify your highest-risk day (payday, weekend, night).',
        'Pre-commit an activity + money rule for that day.',
        'Put the plan in your calendar.',
      ],
      completionCriteria: ['High-risk day is named.', 'Calendar plan exists.'],
      priority: 'high',
    },
    {
      title: 'Urge journal and pattern review',
      instructions: [
        'Review the week’s urge logs for patterns.',
        'Mark which tool worked best.',
        'Strengthen the weakest trigger plan with one upgrade.',
      ],
      completionCriteria: ['You identified one pattern.', 'One trigger plan was upgraded.'],
    },
    {
      title: 'No-bet proof and values reminder',
      instructions: [
        'Write why quitting gambling matters in 5 honest lines.',
        'Count consecutive no-bet days/hours.',
        'Choose next week’s single focus (apps, money, nights, or social).',
      ],
      completionCriteria: ['Values note is written.', 'Next-week focus is chosen.'],
      priority: 'high',
    },
    {
      title: 'Slip recovery protocol',
      instructions: [
        'Write a no-shame restart: close apps, move money, message accountability, restart streak clock.',
        'Rehearse or use it once.',
        'Remove one remaining access path.',
      ],
      completionCriteria: ['Restart protocol is written.', 'One access path was removed.'],
    },
  ];
}

function quitHabitDays(habit: string): DayPlan[] {
  const label = habit || 'the habit';
  return [
    {
      title: `Name why you want to stop ${label}`,
      instructions: [
        `Write 5 honest reasons to stop ${label}.`,
        'Circle the reason that matters most this month.',
        'Put that reason somewhere you will see daily.',
      ],
      completionCriteria: ['5 reasons are written.', 'Top reason is visible daily.'],
    },
    {
      title: `Track ${label} triggers for one day`,
      instructions: [
        'Log every urge: time, place, feeling, what happened next.',
        'Find the top 2 triggers.',
        'Write an if-then for each.',
      ],
      completionCriteria: ['Urge log exists.', '2 if-then plans are written.'],
      priority: 'high',
    },
    {
      title: 'Install a replacement routine',
      instructions: [
        `Choose a 3-step replacement that takes similar time to ${label}.`,
        'Practice it once today.',
        'Keep the steps written on your phone.',
      ],
      completionCriteria: ['Replacement routine is defined.', 'You practiced it once.'],
    },
    {
      title: 'Add friction to the old habit',
      instructions: [
        `Make ${label} harder (logout, hide, delete shortcut, change route).`,
        'Make the replacement easier (prep tools in advance).',
        'Test both changes once.',
      ],
      completionCriteria: ['One friction change is done.', 'Replacement is prepped.'],
      priority: 'high',
    },
    {
      title: 'Survive the hardest window',
      instructions: [
        'Identify your hardest 2-hour window.',
        'Plan activity + support contact for that window.',
        'Complete the window using your replacement.',
      ],
      completionCriteria: ['Hard window plan exists.', 'You completed the window with the plan.'],
    },
    {
      title: 'Streak proof and weekly focus',
      instructions: [
        'Record clean time so far.',
        'Note what helped most.',
        'Pick one focus for next week.',
      ],
      completionCriteria: ['Clean time is logged.', 'Next focus is chosen.'],
      priority: 'high',
    },
  ];
}

function codingDays(skill: string, level: string): DayPlan[] {
  const topic = skill || 'coding';
  const beginner = /begin|novice|new|start/i.test(level);
  return [
    {
      title: `Set up a tiny ${topic} practice space`,
      instructions: [
        `Open your editor or online playground for ${topic}.`,
        'Create a folder/file named daily-practice.',
        'Write a 1-line goal for what “done” means this week.',
      ],
      completionCriteria: ['Practice space exists.', 'Weekly done-line is written.'],
    },
    {
      title: beginner ? `Learn one core ${topic} concept` : `Tighten one weak ${topic} concept`,
      instructions: [
        'Study one short lesson/docs page on today’s concept.',
        'Rewrite the idea in 5 bullets in your own words.',
        'Type one minimal code example from memory.',
      ],
      completionCriteria: ['5 bullets are written.', 'You typed a minimal example without copy-paste.'],
      priority: 'high',
    },
    {
      title: `Solve one focused ${topic} exercise`,
      instructions: [
        'Pick one exercise matching today’s concept.',
        'Timebox to your daily minutes; ship a working attempt.',
        'Write the single bug or confusion you hit.',
      ],
      completionCriteria: ['You produced a working attempt.', 'One confusion is logged.'],
      priority: 'high',
    },
    {
      title: 'Debug and explain your solution',
      instructions: [
        'Re-read yesterday’s code and improve naming or structure once.',
        'Add one test case or manual check.',
        'Explain the solution out loud in 60 seconds.',
      ],
      completionCriteria: ['Code was improved once.', 'You explained it without reading every line.'],
    },
    {
      title: `Build a mini ${topic} feature`,
      instructions: [
        'Define a tiny feature you can finish today.',
        'Implement only that feature.',
        'Commit or save a before/after note of what works.',
      ],
      completionCriteria: ['Feature definition is one sentence.', 'Feature works for the happy path.'],
      priority: 'high',
    },
    {
      title: 'Spaced review of weak spots',
      instructions: [
        'List 3 things that still feel shaky.',
        'Re-do the smallest exercise for the weakest one.',
        'Update your notes with the corrected understanding.',
      ],
      completionCriteria: ['Weak list of 3 exists.', 'One weak item was re-practiced.'],
    },
    {
      title: `Ship a ${topic} demo`,
      instructions: [
        'Package a short demo: screenshot, snippet, or run-through.',
        'List 3 things you can do now that you could not on day 1.',
        'Choose next week’s focus concept.',
      ],
      completionCriteria: ['Demo artifact exists.', '3 new capabilities + next focus are written.'],
      priority: 'high',
    },
    {
      title: `Read real ${topic} code for 20 minutes`,
      instructions: [
        'Open a small open-source file or docs example in your topic.',
        'Trace what one function does.',
        'Copy the pattern into a 10-line sketch of your own.',
      ],
      completionCriteria: ['You traced one function.', 'You wrote a short sketch using the pattern.'],
    },
    {
      title: 'Deliberate practice on errors',
      instructions: [
        'Break a working example on purpose, then fix it.',
        'Note the exact error message and cause.',
        'Write a 2-line checklist to avoid that mistake.',
      ],
      completionCriteria: ['You fixed an intentional break.', 'Checklist of 2 lines exists.'],
    },
    {
      title: `Project hour for ${topic}`,
      instructions: [
        'Work only on your mini-project’s next vertical slice.',
        'Define done before coding.',
        'Stop when done or time ends; write the next slice title.',
      ],
      completionCriteria: ['Done definition was written first.', 'Next slice title is ready.'],
      priority: 'high',
    },
  ];
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
      completionCriteria: ['Prompt states role, goal, and format.', 'You saved one usable output.'],
    },
    {
      title: 'Add constraints and examples',
      instructions: [
        'Take yesterday’s prompt and add 2 constraints.',
        'Add one short example of a good answer.',
        'Compare the new output with yesterday’s.',
      ],
      completionCriteria: ['Prompt includes constraints + example.', 'You named one improvement.'],
    },
    {
      title: 'Break a task into prompt steps',
      instructions: [
        'Choose a multi-step task.',
        'Split it into 3 prompts: research, draft, refine.',
        'Run the chain and keep the final useful result.',
      ],
      completionCriteria: ['3-step chain exists.', 'Final output beats a single-shot attempt.'],
      priority: 'high',
    },
    {
      title: 'Improve weak outputs with critique',
      instructions: [
        'Ask the model to critique a weak answer against your criteria.',
        'Request a revision from that critique.',
        'Edit the revision once by hand.',
      ],
      completionCriteria: ['You used critique-then-revise.', 'Final version has one manual edit.'],
    },
    {
      title: 'Build a reusable prompt template',
      instructions: [
        'Create a template with placeholders like {{topic}}, {{audience}}, {{format}}.',
        beginner ? 'Fill it for two topics.' : 'Fill it for two topics and add evaluation checks.',
        'Save it where you will reuse it.',
      ],
      completionCriteria: ['Template with placeholders exists.', 'Tested on two inputs.'],
      priority: 'high',
    },
    {
      title: 'Evaluate prompt quality',
      instructions: [
        'Score two prompts on clarity, specificity, usefulness (1–5).',
        'Rewrite the weaker prompt.',
        'Write one personal prompting rule.',
      ],
      completionCriteria: ['Two prompts scored with reasons.', 'One rule is written.'],
    },
    {
      title: 'Ship a small prompt workflow',
      instructions: [
        'Combine best prompts into a mini workflow for one real outcome.',
        'Run it end to end.',
        'Write a 5-line recap.',
      ],
      completionCriteria: ['Workflow completed once.', 'Recap with one next improvement exists.'],
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
        `List 5 concrete skills needed for ${skill}.`,
        'Mark known vs need-to-learn.',
        'Pick the skill that unlocks the most progress this week.',
      ],
      completionCriteria: ['5-skill map exists.', 'One focus skill is chosen.'],
    },
    {
      title: `Learn one core idea for ${skill}`,
      instructions: [
        'Study one short lesson on the focus skill.',
        'Write 5 bullets in your own words.',
        'Teach it out loud for 60 seconds.',
      ],
      completionCriteria: ['5 notes written.', 'You explained without reading.'],
    },
    {
      title: `Do a tiny practice for ${skill}`,
      instructions: [
        'Complete one small exercise for the focus skill.',
        'Stay inside your daily minutes.',
        'Write what confused you in one sentence.',
      ],
      completionCriteria: ['One exercise finished.', 'One confusion logged.'],
      priority: 'high',
    },
    {
      title: 'Fix yesterday’s confusion',
      instructions: [
        'Revisit the confusing part with a second example/source.',
        'Redo a smaller version of the practice.',
        'Note the corrected understanding in 3 bullets.',
      ],
      completionCriteria: ['Confusion narrowed or resolved.', 'Corrected practice done.'],
    },
    {
      title: 'Apply it to a real mini-project',
      instructions: [
        `Start a tiny project that uses ${skill}.`,
        'Define done in one sentence.',
        'Work only toward that definition.',
      ],
      completionCriteria: ['Done-line exists.', 'Visible progress made.'],
      priority: 'high',
    },
    {
      title: 'Review and tighten',
      instructions: [
        'Review notes/project against the done line.',
        'Improve one weak part.',
        /advanced|expert/i.test(level)
          ? 'Add one harder variation.'
          : 'Repeat the easiest successful exercise once.',
      ],
      completionCriteria: ['One weak part improved.', 'You can describe what “better” meant today.'],
    },
    {
      title: 'Demonstrate weekly progress',
      instructions: [
        'Produce a short demo of what you can do now.',
        'List 3 new capabilities since day 1.',
        'Choose next week’s focus skill.',
      ],
      completionCriteria: ['Demo exists.', '3 capabilities + next focus written.'],
      priority: 'high',
    },
  ];
}

function fitnessDays(title: string): DayPlan[] {
  return [
    {
      title: 'Baseline movement check',
      instructions: ['Do a gentle warm-up.', 'Record a simple baseline.', 'Stop while form still feels good.'],
      completionCriteria: ['Baseline number logged.', 'Finished without pain.'],
    },
    {
      title: 'Build the main pattern',
      instructions: ['Practice the main movement for your goal.', 'Keep easy effort and clean form.', 'Write one cue that helped.'],
      completionCriteria: ['Main pattern completed.', 'One form cue written.'],
      priority: 'high',
    },
    {
      title: 'Add controlled volume',
      instructions: ['Repeat yesterday’s pattern with one extra easy set.', 'Keep rest honest.', 'Note energy 1–5.'],
      completionCriteria: ['Planned sets done.', 'Energy logged.'],
    },
    {
      title: 'Recovery and mobility',
      instructions: ['Mobility for tight areas.', 'Easy walk/move for most of the session.', 'Set a sleep target tonight.'],
      completionCriteria: ['Recovery session done.', 'Sleep target set.'],
    },
    {
      title: 'Slightly harder session',
      instructions: ['Increase difficulty a little.', 'Keep form above ego.', 'Stop 1–2 reps before form breaks.'],
      completionCriteria: ['Harder session completed with good form.', 'You know what to repeat.'],
      priority: 'high',
    },
    {
      title: 'Skill + consistency check',
      instructions: ['Warm-up + main work + short finisher.', 'Compare to day 1 baseline.', 'Adjust next week 5–10%.'],
      completionCriteria: ['Full short workout done.', 'Next-week target set.'],
    },
    {
      title: `${title} weekly wrap`,
      instructions: ['Repeat your best session at easy effort.', 'Write what improved.', 'Plan next 3 sessions.'],
      completionCriteria: ['Wrap session done.', '3-session outline exists.'],
      priority: 'high',
    },
  ];
}

function careerDays(title: string): DayPlan[] {
  return [
    {
      title: 'Clarify the target role',
      instructions: [
        `Write the role/outcome you want for ${title}.`,
        'List 5 skills that role needs.',
        'Mark your top gap.',
      ],
      completionCriteria: ['Role + 5 skills listed.', 'Top gap marked.'],
    },
    {
      title: 'Ship one portfolio proof',
      instructions: ['Pick one artifact that proves a skill.', 'Improve or create it in today’s minutes.', 'Save a before/after note.'],
      completionCriteria: ['Artifact updated.', 'Before/after note saved.'],
      priority: 'high',
    },
    {
      title: 'Draft a sharp story/bullet',
      instructions: ['Write one achievement using situation → action → result.', 'Cut fluff until it fits 4 lines.', 'Read it out loud once.'],
      completionCriteria: ['SAR story drafted.', 'Read aloud once.'],
    },
    {
      title: 'Do one outreach or application step',
      instructions: ['Complete one real step: apply, message, or update a listing.', 'Log where you sent it.', 'Note a follow-up date.'],
      completionCriteria: ['One external step done.', 'Follow-up date noted.'],
      priority: 'high',
    },
    {
      title: 'Interview drill',
      instructions: ['Answer one likely question on camera or out loud.', 'Note filler words.', 'Re-record/rehearse a tighter version.'],
      completionCriteria: ['One answer practiced twice.', 'One improvement noted.'],
    },
    {
      title: 'Weekly career proof',
      instructions: ['List 3 actions completed this week.', 'Update resume/LinkedIn/portfolio with one line.', 'Choose next week’s single focus.'],
      completionCriteria: ['3 actions listed.', 'One profile line updated.'],
      priority: 'high',
    },
  ];
}

function financeDays(): DayPlan[] {
  return [
    {
      title: 'Capture this week’s money reality',
      instructions: ['List income and must-pay expenses.', 'Note one leak (subscription, impulse, fee).', 'Set a 7-day focus number.'],
      completionCriteria: ['Income/expense snapshot exists.', '7-day focus number set.'],
    },
    {
      title: 'Track every spend today',
      instructions: ['Log each spend in one place.', 'Categorize quickly.', 'Highlight one avoidable spend.'],
      completionCriteria: ['Full-day spend log done.', 'One avoidable spend marked.'],
      priority: 'high',
    },
    {
      title: 'Automate or cut one leak',
      instructions: ['Cancel/reduce one leak OR set an auto-transfer.', 'Write the monthly impact.', 'Celebrate the friction win.'],
      completionCriteria: ['One leak cut or automation set.', 'Monthly impact written.'],
      priority: 'high',
    },
    {
      title: 'Build a simple weekly budget',
      instructions: ['Assign money to needs / wants / savings.', 'Keep it on one page.', 'Check it against yesterday’s log.'],
      completionCriteria: ['One-page weekly budget exists.', 'Checked against a real log.'],
    },
    {
      title: 'Money review and next move',
      instructions: ['Compare plan vs actual.', 'Adjust one category.', 'Choose next week’s single money habit.'],
      completionCriteria: ['Variance noted.', 'Next habit chosen.'],
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
      completionCriteria: ['7-day win defined.', 'One concrete action finished.'],
    },
    {
      title: 'Do the smallest useful version',
      instructions: ['Break today’s work into 3 tiny steps.', 'Complete all three inside your time box.', 'Capture one lesson.'],
      completionCriteria: ['All 3 steps done.', 'One lesson written.'],
      priority: 'high',
    },
    {
      title: 'Deepen the same skill',
      instructions: ['Repeat yesterday’s action with one improvement.', 'Keep scope small.', 'Compare quality before vs after.'],
      completionCriteria: ['One improvement made.', 'Improvement described in one sentence.'],
    },
    {
      title: 'Get feedback or a reference',
      instructions: ['Compare your work to a good example or ask for feedback.', 'List 2 gaps.', 'Fix the easier gap now.'],
      completionCriteria: ['2 gaps identified.', 'Easier gap fixed.'],
    },
    {
      title: 'Make it real-world',
      instructions: ['Apply the work to a real situation.', 'Ship a rough version.', 'Note what still blocks you.'],
      completionCriteria: ['Real-world draft exists.', 'Remaining blocker named.'],
      priority: 'high',
    },
    {
      title: 'Reduce friction',
      instructions: ['Create a checklist so tomorrow is easier.', 'Prep materials in advance.', 'Do one rehearsal.'],
      completionCriteria: ['Checklist exists.', 'Tomorrow’s first step is prepared.'],
    },
    {
      title: 'Weekly proof of progress',
      instructions: ['Show evidence of what changed since day 1.', 'Rate confidence 1–10.', 'Choose next week’s single focus.'],
      completionCriteria: ['Visible proof exists.', 'Next focus chosen.'],
      priority: 'high',
    },
  ];
}

function dayBank(input: RoadmapInput): DayPlan[] {
  const key = topicKey(input);
  const level = input.currentLevel ?? '';
  const skill = skillLabel(input);
  if (key === 'quit-smoking') return quitSmokingDays();
  if (key === 'quit-gambling') return quitGamblingDays();
  if (key === 'quit-habit') return quitHabitDays(skill);
  if (key === 'prompt-engineering') return promptEngineeringDays(level);
  if (key === 'coding') return codingDays(skill, level);
  if (key === 'fitness') return fitnessDays(input.title);
  if (key === 'career') return careerDays(skill);
  if (key === 'finance') return financeDays();
  if (key === 'education') return educationDays(skill, level);
  return genericDays(skill);
}

function materializeDay(template: DayPlan, day: number, week: number): DayPlan {
  if (week <= 1) return template;
  const prefix = week === 2 ? 'Reinforce' : week === 3 ? 'Stretch' : `Week ${week}`;
  return {
    ...template,
    title: `${prefix}: ${template.title}`.slice(0, 200),
    instructions:
      week >= 3
        ? [...template.instructions, 'Raise quality or difficulty 10% vs last time you did this.']
        : template.instructions,
    completionCriteria: template.completionCriteria,
    priority: template.priority ?? (day % 5 === 0 ? 'high' : 'medium'),
  };
}

function milestoneTitle(input: RoadmapInput, index: number, start: number, end: number): string {
  const key = topicKey(input);
  const labels: Record<TopicKey, string[]> = {
    'quit-smoking': ['Trigger map & toolkit', 'Environment & urge control', 'Streak identity'],
    'quit-gambling': ['Access blocks & triggers', 'Urge delay & money friction', 'Accountability & proof'],
    'quit-habit': ['Awareness & replacement', 'Friction & hard windows', 'Streak reinforcement'],
    coding: ['Setup & fundamentals', 'Deliberate practice', 'Build & demo'],
    'prompt-engineering': ['Prompt foundations', 'Prompt systems', 'Prompt mastery'],
    fitness: ['Base & form', 'Progressive load', 'Consistency wrap'],
    career: ['Target & proof', 'Outreach & drills', 'Ship & review'],
    finance: ['Reality check', 'Cuts & systems', 'Review & habit'],
    education: [`Foundations: ${skillLabel(input)}`, `Practice: ${skillLabel(input)}`, `Apply: ${skillLabel(input)}`],
    personal: [`Focus block ${index + 1}`, `Build block ${index + 1}`, `Proof block ${index + 1}`],
  };
  const set = labels[key];
  return (set[Math.min(index, set.length - 1)] ?? `${input.title} · days ${start}–${end}`).slice(0, 200);
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
      const week = Math.floor((day - 1) / 7) + 1;
      const template = materializeDay(bank[(day - 1) % bank.length]!, day, week);
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
      description: `Days ${start}–${end} toward ${input.desiredOutcome || input.title}.`,
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
