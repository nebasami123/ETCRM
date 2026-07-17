import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["apps/server/src/**/*.test.ts"],
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://etcrm:etcrm@127.0.0.1:5433/etcrm_test?schema=public",
      SHADOW_DATABASE_URL: "postgresql://etcrm:etcrm@127.0.0.1:5433/etcrm_shadow?schema=public",
      TEST_DATABASE_URL: "postgresql://etcrm:etcrm@127.0.0.1:5433/etcrm_test?schema=public",
      BETTER_AUTH_SECRET: "test-secret-that-is-longer-than-thirty-two-characters",
      BETTER_AUTH_URL: "http://127.0.0.1:4000",
      CLIENT_URL: "http://127.0.0.1:5173",
      BUSINESS_TIME_ZONE: "Africa/Addis_Ababa",
      MONGODB_URL: "mongodb://127.0.0.1:27017/etcrm_test",
      MONGODB_DB_NAME: "etcrm_test"
    }
  }
});
