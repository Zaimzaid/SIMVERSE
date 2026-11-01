import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { ThemeProvider, themeInitScript } from "@/components/theme/theme-provider";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";
import { BRAND_NAME, BRAND_TAGLINE, BRAND_DESCRIPTION } from "@/lib/brand";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["500", "600", "700"],
});

const APP_NAME = BRAND_NAME;

export const metadata: Metadata = {
  title: {
    default: `${APP_NAME} — ${BRAND_TAGLINE}`,
    template: `%s · ${APP_NAME}`,
  },
  description:
    BRAND_DESCRIPTION,
  applicationName: APP_NAME,
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#070a12",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={`${inter.variable} ${spaceGrotesk.variable} antialiased`}>
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
