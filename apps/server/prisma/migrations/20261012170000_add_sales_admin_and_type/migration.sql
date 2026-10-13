CREATE TYPE "SalesType" AS ENUM ('INTERNAL', 'EXTERNAL');

ALTER TABLE "User" ADD COLUMN "salesType" "SalesType";

UPDATE "User" SET "salesType" = 'INTERNAL' WHERE "role" = 'SALES';
