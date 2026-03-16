import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import CoachFloatingButton from "@/components/CoachFloatingButton";
import Navbar from "@/components/Navbar";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "EquityLens",
  description: "Institutional-grade equity research, powered by AI",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-bg font-sans text-gray-200 antialiased">
        <Navbar />
        <main className="min-h-[calc(100vh-4rem)]">{children}</main>
        <CoachFloatingButton />
      </body>
    </html>
  );
}
