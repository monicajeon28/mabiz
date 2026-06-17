import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const p = new PrismaClient({ adapter });
const tables = await p.$queryRaw`
  SELECT table_name 
  FROM information_schema.tables 
  WHERE table_schema = 'public' 
    AND table_name ILIKE '%user%' OR table_name ILIKE '%gm%' OR table_name ILIKE '%affiliate%'
  ORDER BY table_name;
`;
console.log(JSON.stringify(tables, null, 2));
await p.$disconnect();
