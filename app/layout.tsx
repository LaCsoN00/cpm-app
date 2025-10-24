import { Metadata } from "next";
import { Toaster } from "react-hot-toast";
import "./globals.css";
// Clerk removed - using Supabase Auth
import { SpeedInsights } from "@vercel/speed-insights/next";
import { LayoutClient } from "./LayoutClient";

export const metadata: Metadata = {
  title: "CPM Project",
  description: "Le cabinet qui vous accompagne dans vos projets",
  icons: {
    icon: "/favicon.svg",
  },
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" data-theme="light" suppressHydrationWarning>
      <head>
        <link rel="shortcut icon" href="/favicon.svg" />
        <meta name="apple-mobile-web-app-title" content="Cpm app" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className="bg-transparent">
        <Toaster position="top-center" />
        
        <LayoutClient>
          {children}
        </LayoutClient>
        
        <SpeedInsights />
      </body>
    </html>
  );
}
