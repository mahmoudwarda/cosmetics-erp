ALTER TABLE "users" ALTER COLUMN "accent" SET DEFAULT 'indigo';
UPDATE "users" SET "accent" = 'indigo' WHERE "accent" IN ('rose', 'berry');
