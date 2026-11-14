import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ log: process.env.NODE_ENV === "development" ? ["error"] : ["error"] });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export const PLANS = {
  free: { name: "Free", priceMonthly: 0, maxProjects: 1, maxRefs: 100, reviewers: 1 },
  pro: { name: "Pro", priceMonthly: 79000, priceYearlyMonthly: 63200, priceYearlyTotal: 758400, maxProjects: 10, maxRefs: 5000, reviewers: 5 },
  institusi: { name: "Institusi", priceMonthly: 490000, maxProjects: 999, maxRefs: 99999, reviewers: 999 },
} as const;
export type PlanKey = keyof typeof PLANS;
