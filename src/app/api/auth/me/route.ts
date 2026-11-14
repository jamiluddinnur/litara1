import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ user: null });
  const sub = await prisma.subscription.findUnique({ where: { userId: user.id } });
  return NextResponse.json({ user: { id: user.id, name: user.name, email: user.email }, plan: sub?.plan || "free" });
}
