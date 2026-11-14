import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "./prisma";

export function hashPassword(pw: string): string {
  const salt = randomBytes(16).toString("hex");
  return `scrypt:${salt}:${scryptSync(pw, salt, 64).toString("hex")}`;
}
export function verifyPassword(pw: string, hash: string): boolean {
  const [, salt, key] = hash.split(":");
  if (!salt || !key) return false;
  const derived = scryptSync(pw, salt, 64);
  const stored = Buffer.from(key, "hex");
  return stored.length === derived.length && timingSafeEqual(stored, derived);
}
export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 hari
  await prisma.session.create({ data: { token, userId, expiresAt } });
  return { token, expiresAt };
}
export async function getSessionUser() {
  const token = cookies().get("litara_session")?.value;
  if (!token) return null;
  const s = await prisma.session.findUnique({ where: { token }, include: { user: true } });
  if (!s || s.expiresAt < new Date()) return null;
  return s.user;
}
export async function requireUser() {
  const u = await getSessionUser();
  if (!u) throw new Error("UNAUTHORIZED");
  return u;
}
export function sessionCookie(token: string, expiresAt: Date) {
  return { name: "litara_session", value: token, expires: expiresAt, httpOnly: true, path: "/", sameSite: "lax" as const, secure: process.env.NODE_ENV === "production" };
}
