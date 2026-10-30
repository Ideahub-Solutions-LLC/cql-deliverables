import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DSI Daily Delivery | IdeaHub",
  description: "One plan, clear owners, visible progress. DSI reset execution from October 22 to December 18, 2026.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
