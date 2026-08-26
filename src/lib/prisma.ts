import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
  }

  const adapter = new PrismaPg({
    connectionString,
    // Poolers (Neon, Supabase, pgbouncer) and local dev servers hang up idle
    // connections. Recycle ours first, or the pool hands out a dead socket and
    // the next query fails with P1017 "Server has closed the connection".
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    max: 5,
    // Serverless keeps many short-lived instances around; capping the lifetime
    // stops any one of them holding a connection open indefinitely.
    maxLifetimeSeconds: 300,
  });

  return new PrismaClient({ adapter });
}

// Reuse the client across hot reloads in dev and across warm Fluid Compute
// invocations in production, so we don't exhaust the connection pool.
export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
