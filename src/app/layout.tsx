import type { Metadata, Viewport } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";
import { ThemeToggle } from "@/components/ThemeToggle";

// The Big Board scoreboard design is set in Space Grotesk; load the weights it
// uses and expose it as a CSS variable that globals.css applies as the base font.
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});

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
      <body
        className={`${spaceGrotesk.variable} min-h-screen bg-slate-950 text-slate-100 antialiased`}
      >
        <ThemeToggle />
        {children}
      </body>
    </html>
  );
}
