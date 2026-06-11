/**
 * Make the seeded demo workspace loginable (M28). Run AFTER `pnpm db:seed`:
 *
 *   pnpm db:seed        # data-only seed (placeholder-owned)
 *   pnpm db:seed:auth   # this script — creates a real Better Auth credential
 *
 * The data seed (packages/db) owns its rows via a bare placeholder user that has
 * no credential and cannot log in. This script creates the demo user through
 * Better Auth (so the password is correctly hashed), repoints the seeded data
 * onto that real user, and drops the placeholder. Idempotent: re-running finds
 * the existing user and re-points (a no-op once already pointed).
 *
 * Dev convenience only — never run against a real database.
 */
import { eq } from 'drizzle-orm';
import { opportunities, user, workspaces } from '@pg/db/schema';
import { auth } from './auth';
import { db } from './db';

const PLACEHOLDER_USER_ID = 'seed-user-demo';
const DEMO_EMAIL = 'demo@pitchgenius.test';
const DEMO_PASSWORD = 'demo-password-1234'; // dev-only, printed below

async function main() {
  // 1. Ensure the Better Auth demo user exists (real, hashed credential).
  let realUserId: string;
  const existing = await db.query.user.findFirst({ where: eq(user.email, DEMO_EMAIL) });
  if (existing) {
    realUserId = existing.id;
    console.log(`Better Auth user ${DEMO_EMAIL} already exists (${realUserId}).`);
  } else {
    const res = await auth.api.signUpEmail({
      body: {
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
        name: 'Demo Rep',
        firstName: 'Demo',
        lastName: 'Rep',
      },
    });
    realUserId = res.user.id;
    console.log(`Created Better Auth user ${DEMO_EMAIL} (${realUserId}).`);
  }

  // 2. Repoint placeholder-owned seed data onto the real user, then drop it.
  await db
    .update(workspaces)
    .set({ createdByUserId: realUserId })
    .where(eq(workspaces.createdByUserId, PLACEHOLDER_USER_ID));
  await db
    .update(opportunities)
    .set({ ownerUserId: realUserId })
    .where(eq(opportunities.ownerUserId, PLACEHOLDER_USER_ID));
  const placeholder = await db.query.user.findFirst({ where: eq(user.id, PLACEHOLDER_USER_ID) });
  if (placeholder) {
    await db.delete(user).where(eq(user.id, PLACEHOLDER_USER_ID));
    console.log('Repointed seed data to the real user and removed the placeholder.');
  }

  console.log(`\nDemo login → email: ${DEMO_EMAIL}   password: ${DEMO_PASSWORD}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
