import type { ReactNode } from "react";
import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { cn } from "@/lib/utils";
import "./globals.css";

export const metadata: Metadata = {
  title: "vvvv — modern network protocol analyzer",
  description:
    "Run a tiny core locally, stream decoded traffic into this page, and explore your network in real time.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={cn("dark", GeistSans.variable, GeistMono.variable)}>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
