import "./globals.css";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Litara — Solusi SLR Cerdas untuk Akademia Indonesia", description: "Platform Systematic Literature Review untuk peneliti Indonesia: screening, duplikat, blind review, dan PRISMA." };
export const dynamic = "force-dynamic";
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="id"><body>{children}</body></html>);
}
