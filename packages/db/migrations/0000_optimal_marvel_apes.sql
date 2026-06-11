CREATE TYPE "public"."activity_type" AS ENUM('call', 'video_meeting', 'phone_call', 'email_thread', 'demo', 'proposal_review', 'other');--> statement-breakpoint
CREATE TYPE "public"."alignment_level" AS ENUM('none', 'low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."alignment_outcome" AS ENUM('over_projecting', 'aligned', 'under_projecting');--> statement-breakpoint
CREATE TYPE "public"."closed_status" AS ENUM('open', 'closed_won', 'closed_lost', 'reframed');--> statement-breakpoint
CREATE TYPE "public"."confidence_level" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."crm_stage_template" AS ENUM('simple_b2b_sales', 'custom');--> statement-breakpoint
CREATE TYPE "public"."crm_type" AS ENUM('hubspot', 'pipedrive', 'salesforce', 'highlevel');--> statement-breakpoint
CREATE TYPE "public"."disc_type" AS ENUM('D', 'I', 'S', 'C');--> statement-breakpoint
CREATE TYPE "public"."export_type" AS ENUM('crm_note', 'csv', 'json');--> statement-breakpoint
CREATE TYPE "public"."exported_object_type" AS ENUM('diagnosis', 'opportunity', 'opportunities_batch');--> statement-breakpoint
CREATE TYPE "public"."intake_method" AS ENUM('structured_form', 'quick_paste', 'csv_upload');--> statement-breakpoint
CREATE TYPE "public"."outcome_type" AS ENUM('buyer_replied', 'next_meeting_booked', 'stakeholder_added', 'pricing_requested', 'security_procurement_requested', 'deal_advanced', 'deal_stalled', 'buyer_went_dark', 'closed_won', 'closed_lost', 'other');--> statement-breakpoint
CREATE TYPE "public"."readiness_state" AS ENUM('unaware', 'problem_aware', 'diagnosis_aligned', 'solution_curious', 'solution_confident', 'stakeholder_validation_needed', 'commercially_ready', 'commit_ready', 'at_risk');--> statement-breakpoint
CREATE TYPE "public"."sales_technique" AS ENUM('challenger', 'spin', 'nepq');--> statement-breakpoint
CREATE TYPE "public"."signal_dimension" AS ENUM('pain', 'trust', 'urgency', 'solution_confidence', 'commitment', 'risk');--> statement-breakpoint
CREATE TYPE "public"."signal_source" AS ENUM('transcript', 'rep_note', 'checklist');--> statement-breakpoint
CREATE TYPE "public"."signal_strength" AS ENUM('weak', 'medium', 'strong');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('none', 'trialing', 'active', 'past_due', 'canceled');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "import_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"crm_type" "crm_type",
	"fields" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "script_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"export_type" "export_type" NOT NULL,
	"exported_object_type" "exported_object_type" NOT NULL,
	"exported_object_ids" jsonb NOT NULL,
	"file_url_or_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outcome_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"diagnosis_id" uuid NOT NULL,
	"outcome_type" "outcome_type" NOT NULL,
	"outcome_notes" text,
	"deal_advanced" boolean DEFAULT false NOT NULL,
	"buyer_replied" boolean DEFAULT false NOT NULL,
	"next_meeting_booked" boolean DEFAULT false NOT NULL,
	"stakeholder_added" boolean DEFAULT false NOT NULL,
	"closed_won" boolean DEFAULT false NOT NULL,
	"closed_lost" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "readiness_diagnoses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"activity_id" uuid NOT NULL,
	"signal_extraction" jsonb NOT NULL,
	"diagnosis" jsonb NOT NULL,
	"readiness_state" "readiness_state" NOT NULL,
	"readiness_score" integer NOT NULL,
	"confidence_level" "confidence_level" NOT NULL,
	"alignment_outcome" "alignment_outcome" NOT NULL,
	"alignment_level" "alignment_level" NOT NULL,
	"alignment_reason" text NOT NULL,
	"primary_blocker" text,
	"secondary_blocker" text,
	"crm_note_text" text NOT NULL,
	"follow_up_subject" text,
	"follow_up_body" text,
	"manager_coaching_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "onboarding" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "onboarding_workspace_id_unique" UNIQUE("workspace_id")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"target_buyer" text NOT NULL,
	"problem_solved" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"website" text,
	"industry" text,
	"crm_stage_template" "crm_stage_template" DEFAULT 'simple_b2b_sales' NOT NULL,
	"custom_crm_stages" jsonb,
	"crm_type" "crm_type",
	"subscription_status" "subscription_status" DEFAULT 'none' NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"activity_type" "activity_type" NOT NULL,
	"activity_date" timestamp with time zone NOT NULL,
	"participants" jsonb,
	"transcript_or_notes" text,
	"rep_subjective_notes" text,
	"next_step_agreed" boolean DEFAULT false NOT NULL,
	"stakeholder_added" boolean DEFAULT false NOT NULL,
	"pricing_discussed" boolean DEFAULT false NOT NULL,
	"budget_discussed" boolean DEFAULT false NOT NULL,
	"competitor_discussed" boolean DEFAULT false NOT NULL,
	"implementation_discussed" boolean DEFAULT false NOT NULL,
	"security_discussed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "buyers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text,
	"title" text,
	"company" text NOT NULL,
	"email" text,
	"linkedin" text,
	"website" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opportunities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"buyer_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"owner_user_id" text NOT NULL,
	"opportunity_name" text NOT NULL,
	"current_crm_stage" text NOT NULL,
	"opportunity_value" numeric(14, 2),
	"expected_close_date" date,
	"known_pain" text,
	"known_objection" text,
	"deal_notes" text,
	"crm_record_id" text,
	"current_readiness_state" "readiness_state",
	"current_readiness_score" integer,
	"current_alignment_outcome" "alignment_outcome",
	"current_alignment_level" "alignment_level",
	"at_risk" boolean DEFAULT false NOT NULL,
	"closed_status" "closed_status" DEFAULT 'open' NOT NULL,
	"reframed_from_opportunity_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "precall_intelligence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"psych_profile" jsonb NOT NULL,
	"matched_technique" jsonb NOT NULL,
	"generated_script" jsonb NOT NULL,
	"technique" "sales_technique" NOT NULL,
	"disc_primary_type" "disc_type" NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_mappings" ADD CONSTRAINT "import_mappings_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "script_templates" ADD CONSTRAINT "script_templates_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exports" ADD CONSTRAINT "exports_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exports" ADD CONSTRAINT "exports_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outcome_feedback" ADD CONSTRAINT "outcome_feedback_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outcome_feedback" ADD CONSTRAINT "outcome_feedback_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outcome_feedback" ADD CONSTRAINT "outcome_feedback_diagnosis_id_readiness_diagnoses_id_fk" FOREIGN KEY ("diagnosis_id") REFERENCES "public"."readiness_diagnoses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "readiness_diagnoses" ADD CONSTRAINT "readiness_diagnoses_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "readiness_diagnoses" ADD CONSTRAINT "readiness_diagnoses_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "readiness_diagnoses" ADD CONSTRAINT "readiness_diagnoses_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding" ADD CONSTRAINT "onboarding_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "buyers" ADD CONSTRAINT "buyers_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_buyer_id_buyers_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."buyers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_reframed_from_opportunity_id_opportunities_id_fk" FOREIGN KEY ("reframed_from_opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "precall_intelligence" ADD CONSTRAINT "precall_intelligence_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "precall_intelligence" ADD CONSTRAINT "precall_intelligence_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "import_mappings_workspace_idx" ON "import_mappings" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "script_templates_workspace_idx" ON "script_templates" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "outcomes_diagnosis_idx" ON "outcome_feedback" USING btree ("diagnosis_id");--> statement-breakpoint
CREATE INDEX "diagnoses_opportunity_created_idx" ON "readiness_diagnoses" USING btree ("opportunity_id","created_at");--> statement-breakpoint
CREATE INDEX "diagnoses_activity_idx" ON "readiness_diagnoses" USING btree ("activity_id");--> statement-breakpoint
CREATE INDEX "activities_opportunity_date_idx" ON "activities" USING btree ("opportunity_id","activity_date");--> statement-breakpoint
CREATE INDEX "buyers_workspace_idx" ON "buyers" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "buyers_workspace_company_idx" ON "buyers" USING btree ("workspace_id","company","first_name");--> statement-breakpoint
CREATE INDEX "buyers_workspace_email_idx" ON "buyers" USING btree ("workspace_id","email");--> statement-breakpoint
CREATE INDEX "opportunities_workspace_idx" ON "opportunities" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "opportunities_workspace_buyer_idx" ON "opportunities" USING btree ("workspace_id","buyer_id");--> statement-breakpoint
CREATE INDEX "opportunities_workspace_owner_idx" ON "opportunities" USING btree ("workspace_id","owner_user_id");--> statement-breakpoint
CREATE INDEX "opportunities_workspace_alignment_idx" ON "opportunities" USING btree ("workspace_id","current_alignment_outcome","current_alignment_level");--> statement-breakpoint
CREATE INDEX "precall_opportunity_generated_idx" ON "precall_intelligence" USING btree ("opportunity_id","generated_at");