CREATE TYPE "public"."diagnosis_job_status" AS ENUM('running', 'done', 'failed');--> statement-breakpoint
CREATE TABLE "diagnosis_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"activity_id" uuid NOT NULL,
	"status" "diagnosis_job_status" DEFAULT 'running' NOT NULL,
	"error" text,
	"diagnosis_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "diagnosis_jobs" ADD CONSTRAINT "diagnosis_jobs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnosis_jobs" ADD CONSTRAINT "diagnosis_jobs_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnosis_jobs" ADD CONSTRAINT "diagnosis_jobs_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnosis_jobs" ADD CONSTRAINT "diagnosis_jobs_diagnosis_id_readiness_diagnoses_id_fk" FOREIGN KEY ("diagnosis_id") REFERENCES "public"."readiness_diagnoses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "diagnosis_jobs_opportunity_created_idx" ON "diagnosis_jobs" USING btree ("opportunity_id","created_at");--> statement-breakpoint
CREATE INDEX "diagnosis_jobs_activity_idx" ON "diagnosis_jobs" USING btree ("activity_id");