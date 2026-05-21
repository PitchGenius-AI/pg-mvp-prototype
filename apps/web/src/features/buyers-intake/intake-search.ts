import { z } from 'zod';

// URL-backed state for the /buyers/new intake surface (M14). The active method
// is a search param so the Workbench's "Add opportunity" and "import your list"
// entry points can deep-link straight to the right tab.
export const intakeMethods = ['structured', 'paste', 'import'] as const;
export const intakeMethodSchema = z.enum(intakeMethods);
export type IntakeMethod = z.infer<typeof intakeMethodSchema>;

export const DEFAULT_INTAKE_METHOD: IntakeMethod = 'structured';

export const intakeSearchSchema = z.object({
  method: intakeMethodSchema.optional(),
});

export type IntakeSearchParams = z.infer<typeof intakeSearchSchema>;
