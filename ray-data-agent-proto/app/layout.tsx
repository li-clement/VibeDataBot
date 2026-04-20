import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VibeDataBot",
  description: "Immersive AI Data Development Tool",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark h-full">
      <body className="h-full bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
