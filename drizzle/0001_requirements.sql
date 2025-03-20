CREATE TYPE "public"."requirement_type" AS ENUM('functional', 'technical', 'non-functional', 'user_story');
CREATE TYPE "public"."requirement_status" AS ENUM('draft', 'approved', 'implemented');
CREATE TYPE "public"."status" AS ENUM('unassigned', 'assigned', 'in_progress', 'review', 'completed');

-- Requirements table
CREATE TABLE "requirements" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "project_id" uuid NOT NULL REFERENCES "public"."projects"("id") ON DELETE cascade,
    "title" varchar(255) NOT NULL,
    "description" text NOT NULL,
    "type" "requirement_type" NOT NULL,
    "priority" "priority" NOT NULL,
    "status" "requirement_status" NOT NULL DEFAULT 'draft',
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);

-- Technical Requirements Table
CREATE TABLE "technical_requirements" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "unique_id" varchar(20) NOT NULL UNIQUE,
    "title" varchar(100) NOT NULL,
    "description" text NOT NULL,
    "type" "requirement_type" NOT NULL,
    "technical_stack" text NOT NULL,
    "status" "status" NOT NULL DEFAULT 'unassigned',
    "project_id" uuid NOT NULL REFERENCES "public"."projects"("id") ON DELETE cascade,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Technical Requirement Dependencies
CREATE TABLE "technical_requirement_dependencies" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "dependent_id" uuid NOT NULL REFERENCES "public"."technical_requirements"("id") ON DELETE cascade,
    "dependency_id" uuid NOT NULL REFERENCES "public"."technical_requirements"("id") ON DELETE cascade
);

-- Acceptance Criteria Table
CREATE TABLE "acceptance_criteria" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "description" text NOT NULL,
    "technical_requirement_id" uuid NOT NULL REFERENCES "public"."technical_requirements"("id") ON DELETE cascade
);

-- Functional Requirements Table
CREATE TABLE "functional_requirements" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "unique_id" varchar(20) NOT NULL UNIQUE,
    "title" varchar(100) NOT NULL,
    "description" text NOT NULL,
    "type" "requirement_type" NOT NULL,
    "priority" "priority" NOT NULL,
    "status" "status" NOT NULL DEFAULT 'unassigned',
    "project_id" uuid NOT NULL REFERENCES "public"."projects"("id") ON DELETE cascade,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Functional Requirement Dependencies
CREATE TABLE "functional_requirement_dependencies" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "dependent_id" uuid NOT NULL REFERENCES "public"."functional_requirements"("id") ON DELETE cascade,
    "dependency_id" uuid NOT NULL REFERENCES "public"."functional_requirements"("id") ON DELETE cascade,
    "technical_dependency_id" uuid REFERENCES "public"."technical_requirements"("id") ON DELETE cascade
);

-- Discovery Sessions Table
CREATE TABLE "discovery_sessions" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "project_id" uuid NOT NULL REFERENCES "public"."projects"("id") ON DELETE cascade,
    "domain" text NOT NULL,
    "stage" text NOT NULL,
    "responses" jsonb DEFAULT '{}',
    "created_at" timestamp with time zone DEFAULT now(),
    "updated_at" timestamp with time zone DEFAULT now()
);