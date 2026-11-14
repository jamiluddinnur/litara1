import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
// Hanya untuk MODE SIMULASI. Di mode Midtrans, pembayaran dikonfirmasi
// oleh webhook Midtrans, bukan endpoint ini.
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { orderId } = await req.json();
    const payment = await prisma.payment.findUnique({ where: { orderId } });
    if (!payment || payment.userId !== user.id) return NextResponse.json({ error: "Pesanan tidak ditemukan." }, { status: 404 });
    if (payment.mode !== "simulasi") return NextResponse.json({ error: "Pesanan Midtrans dikonfirmasi lewat webhook, bukan simulasi." }, { status: 400 });
    await prisma.payment.update({ where: { orderId }, data: { status: "paid" } });
    await prisma.subscription.upsert({ where: { userId: user.id }, update: { plan: payment.plan, status: "active", renewsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }, create: { userId: user.id, plan: payment.plan, status: "active", renewsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } });
    return NextResponse.json({ ok: true, note: "Pembayaran simulasi ditandai Lunas. Ini BUKAN tagihan nyata." });
  } catch { return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 }); }
}
