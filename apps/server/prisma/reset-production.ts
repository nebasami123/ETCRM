import { env } from "../src/config/env.js";
import { prisma } from "../src/config/db.js";

const confirmation = "RESET_ETCRM_PRODUCTION_DATABASE";

async function main() {
  if (env.NODE_ENV !== "production") {
    throw new Error("db:reset:prod can only run with NODE_ENV=production.");
  }

  if (process.env.CONFIRM_DB_RESET !== confirmation) {
    throw new Error(`Refusing to reset the database. Re-run with CONFIRM_DB_RESET=${confirmation}.`);
  }

  console.warn("Dropping the public schema and all ETCRM data...");
  await prisma.$executeRawUnsafe('DROP SCHEMA public CASCADE;');
  await prisma.$executeRawUnsafe('CREATE SCHEMA public;');
  console.log("Database cleared. Applying migrations next.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
