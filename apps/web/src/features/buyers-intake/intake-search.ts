import { z } from 'zod';

// URL-backed state for the /buyers/new intake surface (M14, +M15). The active
// method is a search param so the Workbench's "Add opportunity" / "import your
// list" entry points and the Daily Workbench import's done-step CTA can
// deep-link straight to the right tab. `activity` is the M15 Activities import.
export const intakeMethods = ['structured', 'paste', 'import', 'activity'] as const;
export const intakeMethodSchema = z.enum(intakeMethods);
export type IntakeMethod = z.infer<typeof intakeMethodSchema>;

export const DEFAULT_INTAKE_METHOD: IntakeMethod = 'structured';

export const intakeSearchSchema = z.object({
  method: intakeMethodSchema.optional(),
});

export type IntakeSearchParams = z.infer<typeof intakeSearchSchema>;
