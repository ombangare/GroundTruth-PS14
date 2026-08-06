import type { Metadata } from "next";
import { Sora, Manrope, JetBrains_Mono } from "next/font/google";
import CopilotWidget from "@/components/CopilotWidget";
import "./globals.css";

const display = Sora({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-display",
});

const body = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "GroundTruth - Environmental Intelligence Platform",
  description: "Satellite-derived SDG tracking from orbit to ground.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${display.variable} ${body.variable} ${mono.variable} font-body aurora-bg min-h-screen`}
      >
        <div className="grain" />
        <div className="scan-sweep" />
        <div className="relative z-10">{children}</div>
        
        {/* Floating AI Copilot Widget */}
        <CopilotWidget />
      </body>
    </html>
  );
}