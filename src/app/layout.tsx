import type { Metadata, Viewport } from "next";
import { RegisterServiceWorker } from "@/components/register-sw";
import "@fontsource-variable/inter";
import "@fontsource-variable/archivo";
import "./globals.css";

export const metadata: Metadata = {
  title: "Coltasi Fit",
  description:
    "Workout tracking, nutrition logging, and body composition progress for the Coltasi Fit program.",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon.png",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Coltasi Fit",
  },
};

export const viewport: Viewport = {
  themeColor: "#163360",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-bg text-text">
        <RegisterServiceWorker />
        {children}
      </body>
    </html>
  );
}
