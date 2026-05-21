import { router } from '../trpc';
import { workspaceRouter } from './workspace';
import { opportunityRouter } from './opportunity';
import { activityRouter } from './activity';
import { diagnosisRouter } from './diagnosis';
import { parserRouter } from './parser';

export const appRouter = router({
  workspace: workspaceRouter,
  opportunity: opportunityRouter,
  activity: activityRouter,
  diagnosis: diagnosisRouter,
  parser: parserRouter,
});

export type AppRouter = typeof appRouter;
