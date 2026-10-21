CREATE TABLE "login_attempts" (
  "key" varchar(64) PRIMARY KEY NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "window_started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "blocked_until" timestamp with time zone
);
