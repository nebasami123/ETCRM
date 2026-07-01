import bcrypt from "bcryptjs";
import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

const required = ["ADMIN_NAME", "ADMIN_EMAIL", "ADMIN_PASSWORD"];
const missing = required.filter((key) => !process.env[key]);

if (missing.length) {
  console.error(`Missing required environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

const adminName = requiredEnv("ADMIN_NAME");
const adminEmail = requiredEnv("ADMIN_EMAIL");
const adminPassword = requiredEnv("ADMIN_PASSWORD");

if (adminPassword.length < 12) {
  console.error("ADMIN_PASSWORD must be at least 12 characters for production.");
  process.exit(1);
}

async function main() {
  const passwordHash = await bcrypt.hash(adminPassword, 10);
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: adminName,
      passwordHash,
      role: Role.ADMIN
    },
    create: {
      name: adminName,
      email: adminEmail,
      passwordHash,
      role: Role.ADMIN
    },
    select: { id: true, email: true, role: true }
  });

  console.log(`Production admin ready: ${admin.email}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
