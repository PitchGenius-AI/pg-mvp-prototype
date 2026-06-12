import { auth } from './auth';
import { db } from './db';
import { anthropic } from './ai';

export async function createContext(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  return {
    db,
    anthropic,
    // Forwarded so procedures can call Better Auth server APIs that read the
    // caller's session from headers (e.g. copilot.mintLaunchToken → PG-289).
    headers: req.headers,
    user: session?.user ?? null,
    session: session?.session ?? null,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
