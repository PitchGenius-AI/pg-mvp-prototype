import { router } from '../trpc';
import { workspaceRouter } from './workspace';
import { productRouter } from './product';
import { buyerRouter } from './buyer';
import { workbenchRouter } from './workbench';
import { opportunityRouter } from './opportunity';
import { activityRouter } from './activity';
import { diagnosisRouter } from './diagnosis';
import { parserRouter } from './parser';

export const appRouter = router({
  workspace: workspaceRouter,
  product: productRouter,
  buyer: buyerRouter,
  workbench: workbenchRouter,
  opportunity: opportunityRouter,
  activity: activityRouter,
  diagnosis: diagnosisRouter,
  parser: parserRouter,
});

export type AppRouter = typeof appRouter;
