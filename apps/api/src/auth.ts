import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { bearer, oneTimeToken } from 'better-auth/plugins';
import { account, session, user, verification } from '@pg/db/schema';
import { db } from './db';
import { env } from './env';
import { DESKTOP_ORIGINS } from './origins';

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: { user, session, account, verification },
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  // The desktop Co-pilot webview verifies the one-time token cross-origin (PG-289).
  trustedOrigins: [env.WEB_URL, ...DESKTOP_ORIGINS],
  plugins: [
    // Desktop Co-pilot auth handoff (M33/PG-289).
    // `bearer`: lets the desktop authenticate tRPC calls with
    //   `Authorization: Bearer <sessionToken>` instead of a cookie (a native app
    //   has no cookie jar). `getSession()` already reads it, so
    //   `protectedProcedure` is unchanged; cookie auth (web) is unaffected.
    bearer(),
    // `oneTimeToken`: the web app (cookie-authed) mints a short-lived, single-use
    //   token that travels in the `pitchgenius://` deeplink; the desktop exchanges
    //   it at `/api/auth/one-time-token/verify` for a real session (the bearer
    //   token comes back in the `set-auth-token` response header). Stored hashed
    //   at rest; a 5-minute TTL covers app launch + window focus.
    oneTimeToken({ expiresIn: 5, storeToken: 'hashed' }),
  ],
});

export type AuthSession = typeof auth.$Infer.Session;
