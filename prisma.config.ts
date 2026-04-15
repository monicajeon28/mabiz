import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Next.js는 .env.local을 자동 로드하지만, Prisma CLI는 직접 로드해야 함
config({ path: ".env.local" });
config({ path: ".env" }); // fallback

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
