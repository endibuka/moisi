import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Moisi MCP",
  description: "Model Context Protocol server for Moisi",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full bg-[#000] text-[#ededed]">{children}</body>
    </html>
  );
}
