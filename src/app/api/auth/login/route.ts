import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, createSession, sessionCookie } from "@/lib/auth";
export async function POST(req: Request) {
  const { email, password } = await req.json().catch(() => ({}));
  const user = await prisma.user.findUnique({ where: { email: String(email || "").toLowerCase() } });
  if (!user || !verifyPassword(String(password || ""), user.passwordHash)) return NextResponse.json({ error: "Email atau kata sandi salah." }, { status: 401 });
  const { token, expiresAt } = await createSession(user.id);
  const res = NextResponse.json({ ok: true, user: { id: user.id, name: user.name, email: user.email } });
  const c = sessionCookie(token, expiresAt); res.cookies.set(c.name, c.value, { expires: c.expires, httpOnly: true, path: "/", sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  return res;
}
