import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pudge Wars",
  description: "Real-time multiplayer hook combat arena",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
