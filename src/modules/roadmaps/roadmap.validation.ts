import { z } from 'zod';

export const generatedTaskSchema = z.object({
  day: z.number().int().min(1).max(366),
  title: z.string().trim().min(1).max(200),
  durationMinutes: z.number().int().min(10).max(480),
  priority: z.enum(['low', 'medium', 'high']),
  instructions: z.array(z.string().trim().min(1).max(500)).max(8).default([]),
  completionCriteria: z.array(z.string().trim().min(1).max(300)).max(8).default([]),
});

export const generatedMilestoneSchema = z.object({
  title: z.string().trim().min(1).max(200),
  sequence: z.number().int().min(1).max(30),
  description: z.string().trim().max(1000).optional().default(''),
  tasks: z.array(generatedTaskSchema).min(1).max(40),
});

export const generatedRoadmapSchema = z.object({
  goal: z.object({
    title: z.string().trim().min(1).max(200),
    durationDays: z.number().int().min(1).max(180),
    category: z.string().trim().min(1).max(50),
  }),
  milestones: z.array(generatedMilestoneSchema).min(1).max(26),
});

export type GeneratedRoadmap = z.infer<typeof generatedRoadmapSchema>;
export type GeneratedTask = z.infer<typeof generatedTaskSchema>;

export interface RoadmapConstraints {
  durationDays: number;
  dailyMinutes: number;
}

export function validateRoadmapPlan(plan: GeneratedRoadmap, constraints: RoadmapConstraints): string[] {
  const errors: string[] = [];

  if (plan.goal.durationDays !== constraints.durationDays) {
    errors.push(`Goal durationDays must be ${constraints.durationDays}`);
  }

  const milestones = [...plan.milestones].sort((a, b) => a.sequence - b.sequence);
  const sequences = milestones.map((milestone) => milestone.sequence);
  const expectedSequences = milestones.map((_, index) => index + 1);
  if (sequences.join(',') !== expectedSequences.join(',')) {
    errors.push('Milestone sequences must be unique and contiguous starting at 1');
  }

  const seenDay = new Set<number>();
  const titlesByDay = new Map<number, Set<string>>();
  const minutesByDay = new Map<number, number>();
  let expectedDay = 1;

  for (const milestone of milestones) {
    const days = [...new Set(milestone.tasks.map((task) => task.day))].sort((a, b) => a - b);
    if (days.length === 0) {
      errors.push(`Milestone ${milestone.sequence} has no tasks`);
      continue;
    }

    if (days[0] !== expectedDay) {
      errors.push(
        `Milestone ${milestone.sequence} must start on day ${expectedDay} so milestones stay in order`,
      );
    }

    for (let index = 1; index < days.length; index += 1) {
      if (days[index] !== days[index - 1] + 1) {
        errors.push(`Milestone ${milestone.sequence} must cover contiguous days`);
        break;
      }
    }

    for (const task of milestone.tasks) {
      if (task.day < 1 || task.day > constraints.durationDays) {
        errors.push(`Task "${task.title}" has day ${task.day} outside 1..${constraints.durationDays}`);
      }
      if (task.durationMinutes > constraints.dailyMinutes) {
        errors.push(`Task "${task.title}" exceeds the daily time limit of ${constraints.dailyMinutes} minutes`);
      }
      if (seenDay.has(task.day) && days.filter((day) => day === task.day).length > 0) {
        const ownerCount = milestones.filter((item) => item.tasks.some((candidate) => candidate.day === task.day)).length;
        if (ownerCount > 1) {
          errors.push(`Day ${task.day} is assigned to more than one milestone`);
        }
      }
      seenDay.add(task.day);

      const titleKey = task.title.trim().toLowerCase();
      const titles = titlesByDay.get(task.day) ?? new Set<string>();
      if (titles.has(titleKey)) {
        errors.push(`Duplicate task "${task.title}" on day ${task.day}`);
      }
      titles.add(titleKey);
      titlesByDay.set(task.day, titles);
      minutesByDay.set(task.day, (minutesByDay.get(task.day) ?? 0) + task.durationMinutes);
    }

    if (days.length > 0) {
      expectedDay = days[days.length - 1] + 1;
    }
  }

  for (let day = 1; day <= constraints.durationDays; day += 1) {
    if (!seenDay.has(day)) {
      errors.push(`Missing tasks for day ${day}`);
    }
    const minutes = minutesByDay.get(day) ?? 0;
    if (minutes > constraints.dailyMinutes) {
      errors.push(`Day ${day} totals ${minutes} minutes, above the ${constraints.dailyMinutes} minute limit`);
    }
  }

  if (expectedDay - 1 !== constraints.durationDays && seenDay.size > 0) {
    errors.push('Roadmap days must cover the full duration without gaps');
  }

  return [...new Set(errors)];
}

export function parseGeneratedRoadmap(payload: unknown, constraints: RoadmapConstraints): GeneratedRoadmap {
  const parsed = generatedRoadmapSchema.safeParse(payload);
  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
    throw new Error(message || 'Roadmap JSON failed schema validation');
  }
  const issues = validateRoadmapPlan(parsed.data, constraints);
  if (issues.length > 0) {
    throw new Error(issues.join('; '));
  }
  return parsed.data;
}
