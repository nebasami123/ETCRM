import { auth } from "../src/auth/auth.js";
import { env } from "../src/config/env.js";
import { prisma } from "../src/config/db.js";

async function main() {
  if (!env.ADMIN_NAME || !env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) {
    throw new Error("ADMIN_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD are required for production bootstrap.");
  }
  if (env.ADMIN_PASSWORD.length < 12) throw new Error("ADMIN_PASSWORD must be at least 12 characters.");
  const existing = await prisma.user.findUnique({ where: { email: env.ADMIN_EMAIL } });
  if (existing) {
    await prisma.user.update({ where: { id: existing.id }, data: { name: env.ADMIN_NAME, role: "ADMIN" } });
    console.log(`Production admin already ready: ${existing.email}`);
    return;
  }
  const result = await auth.api.createUser({ body: { name: env.ADMIN_NAME, email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD, role: "ADMIN" as never } });
  console.log(`Production admin ready: ${result.user.email}`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
