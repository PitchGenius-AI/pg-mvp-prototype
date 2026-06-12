import { router } from '../trpc';
import { workspaceRouter } from './workspace';
import { productRouter } from './product';
import { buyerRouter } from './buyer';
import { workbenchRouter } from './workbench';
import { opportunityRouter } from './opportunity';
import { activityRouter } from './activity';
import { diagnosisRouter } from './diagnosis';
import { precallRouter } from './precall';
import { parserRouter } from './parser';
import { enrichmentRouter } from './enrichment';
import { copilotRouter } from './copilot';

export const appRouter = router({
  workspace: workspaceRouter,
  product: productRouter,
  buyer: buyerRouter,
  workbench: workbenchRouter,
  opportunity: opportunityRouter,
  activity: activityRouter,
  diagnosis: diagnosisRouter,
  precall: precallRouter,
  parser: parserRouter,
  enrichment: enrichmentRouter,
  copilot: copilotRouter,
});

export type AppRouter = typeof appRouter;
