import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyMidtransSignature } from "@/lib/midtrans";
// Webhook Midtrans: POST /api/webhooks/midtrans
// Verifikasi signature SHA512: order_id + status_code + gross_amount + ServerKey
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { order_id, status_code, gross_amount, signature_key, transaction_status } = body;
  if (!order_id || !signature_key) return NextResponse.json({ error: "Payload tidak lengkap." }, { status: 400 });
  if (!process.env.MIDTRANS_SERVER_KEY) return NextResponse.json({ error: "MIDTRANS_SERVER_KEY belum dipasang." }, { status: 400 });
  const ok = verifyMidtransSignature(String(order_id), String(status_code), String(gross_amount))(String(signature_key));
  if (!ok) return NextResponse.json({ error: "Signature tidak valid." }, { status: 403 });
  const payment = await prisma.payment.findUnique({ where: { orderId: String(order_id) } });
  if (!payment) return NextResponse.json({ ok: true });
  const paid = ["capture", "settlement"].includes(String(transaction_status));
  const failed = ["cancel", "deny", "expire", "failure"].includes(String(transaction_status));
  await prisma.payment.update({ where: { orderId: String(order_id) }, data: { status: paid ? "paid" : failed ? "failed" : "pending" } });
  if (paid) await prisma.subscription.upsert({ where: { userId: payment.userId }, update: { plan: payment.plan, status: "active", renewsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }, create: { userId: payment.userId, plan: payment.plan, status: "active", renewsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } });
  return NextResponse.json({ ok: true });
}
