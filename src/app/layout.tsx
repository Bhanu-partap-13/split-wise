import ConvexClientProvider from "@/components/providers/ConvexClientProvider";
import type { Metadata } from "next";
import { Onest, Open_Sans, Geist } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const onest = Onest({
  variable: "--font-onest",
  subsets: ["latin"],
});

const openSans = Open_Sans({
  variable: "--font-open-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Splitwise Clone",
  description: "Professional expense sharing platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn("h-full", "antialiased", onest.variable, openSans.variable, "font-sans", geist.variable)}
    >
      <body className="min-h-full flex flex-col">
        <ConvexClientProvider>
          {children}
          <Toaster position="top-right" richColors />
        </ConvexClientProvider>
      </body>
    </html>
  );
}