import { GeneratedRoadmap, validateRoadmapPlan } from '../src/modules/roadmaps/roadmap.validation';

export function buildMockPlan(): GeneratedRoadmap {
  return {
    goal: { title: 'Learn Java', durationDays: 2, category: 'education' },
    milestones: [
      {
        title: 'Start',
        sequence: 1,
        description: 'Day 1 only',
        tasks: [
          {
            day: 1,
            title: 'Introduction',
            durationMinutes: 30,
            priority: 'high',
            instructions: ['Read the overview.'],
            completionCriteria: ['You can explain the topic.'],
          },
        ],
      },
    ],
  };
}

export { validateRoadmapPlan };
