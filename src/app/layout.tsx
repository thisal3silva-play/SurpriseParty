import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Surprise Party | Games for everyone",
  description: "Create a room, invite your friends, and play birthday party games together.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
