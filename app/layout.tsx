import { Metadata } from "next";
import { Toaster } from "react-hot-toast";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";

export const metadata: Metadata = {
  title: "CPM",
  description: "Le cabinet qui vous accompagne dans vos projets",
  icons: {
    icon: "/icons/favicon.svg",
  },
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="fr" data-theme="light" suppressHydrationWarning>
        <head>
          <link rel="shortcut icon" href="/favicon.svg" />
          <meta name="apple-mobile-web-app-title" content="cpm app" />
          <link rel="manifest" href="/manifest.json" />
        </head>
        <body>
          <Toaster position="top-center" />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
