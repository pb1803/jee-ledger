import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { BottomNav } from "@/components/bottom-nav";
import { ViewerNav } from "@/components/viewer-nav";
import { PwaRegister } from "@/components/pwa-register";
import { OfflineBanner } from "@/components/offline-banner";
import { getCurrentUser } from "@/lib/auth";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "JEE Track",
  description: "Mobile-first JEE preparation tracking for one student",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "JEE Track",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#0284c7",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();
  const isViewer = user?.role === "VIEWER";

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
        <PwaRegister />
        <OfflineBanner />
        <div className="flex-1">{children}</div>
        {isViewer ? <ViewerNav /> : <BottomNav />}
      </body>
    </html>
  );
}
