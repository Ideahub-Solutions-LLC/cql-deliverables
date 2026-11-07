import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./workspace.css";
import "./login/login.css";
import "./responsive.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "DSI Daily Delivery | IdeaHub",
  description: "One plan, clear owners, visible progress. DSI reset execution from October 22 to December 18, 2026.",
  icons: {
    icon: "/ideahub-icon.png",
    shortcut: "/ideahub-icon.png",
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
