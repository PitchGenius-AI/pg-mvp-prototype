import { auth } from '../auth';
import { protectedProcedure, router } from '../trpc';

// Desktop Co-pilot launch handoff (M33/PG-289). The web app (cookie-authed)
// calls `mintLaunchToken` to get a short-lived, single-use token that travels
// in the `pitchgenius://` deeplink; the desktop exchanges it at
// `/api/auth/one-time-token/verify` for a real session it then uses as a bearer
// token. The token is identity-only — which opportunity the call binds to rides
// in the deeplink path (`session/{opportunityId}`), not in the token.
export const copilotRouter = router({
  mintLaunchToken: protectedProcedure.mutation(async ({ ctx }) => {
    const { token } = await auth.api.generateOneTimeToken({ headers: ctx.headers });
    return { token };
  }),
});
