import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Stephanie's Birthday!!!!!",
  description: "How well do you know steph?",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
