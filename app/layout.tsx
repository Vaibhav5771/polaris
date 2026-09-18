import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { dark, shadcn } from "@clerk/ui/themes";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Polaris",
  description: "AI-powered writing workspace",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ClerkProvider
          afterSignOutUrl="/sign-in"
          appearance={{
            theme: [shadcn, dark],
            variables: {
              colorBackground: "var(--background)",
              colorInput: "var(--input)",
              colorPrimary: "var(--primary)",
              colorPrimaryForeground: "var(--primary-foreground)",
              colorForeground: "var(--foreground)",
              colorMutedForeground: "var(--muted-foreground)",
              fontFamily: "var(--font-sans), ui-sans-serif, system-ui, sans-serif",
              fontFamilyButtons:
                "var(--font-sans), ui-sans-serif, system-ui, sans-serif",
              borderRadius: "var(--radius)",
            },
          }}
        >
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
