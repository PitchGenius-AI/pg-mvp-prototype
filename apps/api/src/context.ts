import { auth } from './auth';
import { db } from './db';
import { anthropic } from './ai';

export async function createContext(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  return {
    db,
    anthropic,
    user: session?.user ?? null,
    session: session?.session ?? null,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
