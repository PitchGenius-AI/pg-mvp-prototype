import { router } from '../trpc';
import { workspaceRouter } from './workspace';
import { opportunityRouter } from './opportunity';
import { interactionRouter } from './interaction';
import { diagnosisRouter } from './diagnosis';
import { parserRouter } from './parser';

export const appRouter = router({
  workspace: workspaceRouter,
  opportunity: opportunityRouter,
  interaction: interactionRouter,
  diagnosis: diagnosisRouter,
  parser: parserRouter,
});

export type AppRouter = typeof appRouter;
