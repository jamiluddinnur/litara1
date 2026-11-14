import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, createSession, sessionCookie } from "@/lib/auth";
export async function POST(req: Request) {
  const { name, email, password } = await req.json().catch(() => ({}));
  if (!name || !email || !password || password.length < 6) return NextResponse.json({ error: "Nama, email, dan kata sandi minimal 6 karakter wajib diisi." }, { status: 400 });
  const exists = await prisma.user.findUnique({ where: { email: String(email).toLowerCase() } });
  if (exists) return NextResponse.json({ error: "Email sudah terdaftar. Silakan masuk." }, { status: 400 });
  const user = await prisma.user.create({ data: { name, email: String(email).toLowerCase(), passwordHash: hashPassword(password) } });
  await prisma.subscription.create({ data: { userId: user.id, plan: "free" } });
  const { token, expiresAt } = await createSession(user.id);
  const res = NextResponse.json({ ok: true, user: { id: user.id, name: user.name, email: user.email } });
  const c = sessionCookie(token, expiresAt); res.cookies.set(c.name, c.value, { expires: c.expires, httpOnly: true, path: "/", sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  return res;
}
