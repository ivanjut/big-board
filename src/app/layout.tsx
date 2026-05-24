import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeToggle } from "@/components/ThemeToggle";

// Applies the saved theme before first paint so light-mode users don't see a
// dark flash. Dark is the default when nothing is stored.
const themeScript = `try{if(localStorage.theme==='light')document.documentElement.classList.add('light')}catch(e){}`;

export const metadata: Metadata = {
  title: "Big Board",
  description: "Offline fantasy football draft board",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        <ThemeToggle />
        {children}
      </body>
    </html>
  );
}
