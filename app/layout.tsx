import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Todo Workshop",
  description: "A focused, passkey-secured workspace for your tasks.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
