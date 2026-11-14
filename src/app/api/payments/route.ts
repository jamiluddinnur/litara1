import { NextResponse } from "next/server";
import { prisma, PLANS } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { createSnapOrder, midtransMode } from "@/lib/midtrans";
export async function GET() {
  try { const user = await requireUser(); const payments = await prisma.payment.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }); return NextResponse.json({ payments, mode: midtransMode() }); }
  catch { return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 }); }
}
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { plan, method, yearly } = await req.json();
    if (!["pro", "institusi"].includes(plan)) return NextResponse.json({ error: "Paket tidak valid." }, { status: 400 });
    const amount = plan === "pro" ? (yearly ? PLANS.pro.priceYearlyTotal : PLANS.pro.priceMonthly) : PLANS.institusi.priceMonthly;
    const orderId = `LITARA-${Date.now().toString(36).toUpperCase()}`;
    const snap = await createSnapOrder(orderId, amount, user.email, user.name);
    const payment = await prisma.payment.create({ data: { orderId, userId: user.id, plan, amount, method: method || "qris", status: "pending", mode: snap.mode, redirectUrl: snap.redirectUrl } });
    return NextResponse.json({ ok: true, payment, mode: snap.mode, redirectUrl: snap.redirectUrl, note: snap.mode === "simulasi" ? "MODE SIMULASI: MIDTRANS_SERVER_KEY belum dipasang, tidak ada tagihan nyata. Pasang kunci di env var untuk transaksi Snap sungguhan." : "Pesanan Midtrans Snap dibuat. Selesaikan pembayaran di halaman Snap." });
  } catch (e) { return NextResponse.json({ error: "Gagal membuat pesanan." }, { status: 500 }); }
}
