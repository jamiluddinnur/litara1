import { createHash } from "crypto";
// Midtrans Snap integration.
// - If MIDTRANS_SERVER_KEY is set: create a REAL Snap order (no real charge
//   happens until the user pays in the Snap page / QRIS).
// - If it is absent: return mode "simulasi" with no redirect URL. The UI
//   labels this clearly; nothing is charged.
export const midtransConfigured = () => Boolean(process.env.MIDTRANS_SERVER_KEY);
export const midtransMode = () => (midtransConfigured() ? "midtrans" : "simulasi");

export async function createSnapOrder(orderId: string, amount: number, email: string, name: string) {
  const key = process.env.MIDTRANS_SERVER_KEY;
  if (!key) return { mode: "simulasi" as const, redirectUrl: "", token: "" };
  const base = process.env.MIDTRANS_IS_PRODUCTION === "true" ? "https://app.midtrans.com" : "https://app.sandbox.midtrans.com";
  const res = await fetch(`${base}/snap/v1/transactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Basic ${Buffer.from(key + ":").toString("base64")}` },
    body: JSON.stringify({
      transaction_details: { order_id: orderId, gross_amount: amount },
      customer_details: { first_name: name, email },
      callbacks: { finish: `${process.env.NEXT_PUBLIC_APP_URL || ""}/dashboard?payment=finish` },
    }),
  });
  if (!res.ok) throw new Error(`Midtrans Snap gagal: ${res.status}`);
  const data = await res.json();
  return { mode: "midtrans" as const, redirectUrl: data.redirect_url || "", token: data.token || "" };
}

export function verifyMidtransSignature(orderId: string, statusCode: string, grossAmount: string): (sig: string) => boolean {
  return (sig: string) => {
    const key = process.env.MIDTRANS_SERVER_KEY || "";
    const expected = createHash("sha512").update(orderId + statusCode + grossAmount + key).digest("hex");
    return expected === sig;
  };
}

export async function checkMidtransStatus(orderId: string) {
  const key = process.env.MIDTRANS_SERVER_KEY;
  if (!key) return null;
  const base = process.env.MIDTRANS_IS_PRODUCTION === "true" ? "https://api.midtrans.com" : "https://api.sandbox.midtrans.com";
  const res = await fetch(`${base}/v2/${orderId}/status`, { headers: { Authorization: `Basic ${Buffer.from(key + ":").toString("base64")}` } });
  if (!res.ok) return null;
  return res.json();
}
