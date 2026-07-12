import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin } from "better-auth/plugins";
import { defaultRoles } from "better-auth/plugins/admin/access";
import { prisma } from "../config/db.js";
import { allowedOrigins, env } from "../config/env.js";

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: allowedOrigins,
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    revokeSessionsOnPasswordReset: true
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 10 },
      "/admin/create-user": { window: 60, max: 20 },
      "/admin/set-user-password": { window: 60, max: 20 }
    }
  },
  plugins: [
    admin({
      defaultRole: "SALES",
      adminRoles: ["ADMIN"],
      roles: {
        ADMIN: defaultRoles.admin,
        SALES: defaultRoles.user
      },
      bannedUserMessage: "Your ETCRM account is disabled. Contact an administrator."
    })
  ],
  advanced: {
    useSecureCookies: env.NODE_ENV === "production",
    ipAddress: {
      ipAddressHeaders: ["x-forwarded-for"]
    }
  }
});
