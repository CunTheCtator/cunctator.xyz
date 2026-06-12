import type { Metadata } from "next";
import { Oxanium, Nunito_Sans } from "next/font/google";
import "./globals.css";

const oxanium = Oxanium({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const nunitoSans = Nunito_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["300", "400", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://cunctator.xyz"),
  title: "cunctator",
  description: "Personal site: projects, worldbuilding, and a browser tactics game.",
  openGraph: {
    title: "cunctator",
    description: "I build systems, fictional worlds, and the rules that govern both.",
    url: "https://cunctator.xyz",
    siteName: "cunctator",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "cunctator",
    description: "I build systems, fictional worlds, and the rules that govern both.",
  },
  icons: {
    other: [{ rel: "mask-icon", url: "/safari-pinned-tab.svg", color: "#0096b4" }],
  },
};

export const viewport = {
  themeColor: "#0D1117",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${oxanium.variable} ${nunitoSans.variable}`}
    >
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}
