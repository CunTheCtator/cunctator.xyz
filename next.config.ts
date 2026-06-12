import type { NextConfig } from "next";

// React requires eval() in development for debugging features, and HMR needs
// websocket connections; production never uses either.
const IS_DEV = process.env.NODE_ENV === "development";
const SCRIPT_SRC = IS_DEV
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
  : "script-src 'self' 'unsafe-inline'";
const CONNECT_SRC = IS_DEV ? "connect-src 'self' ws: wss:" : "connect-src 'self'";

const SECURITY_HEADERS = [
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      SCRIPT_SRC,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      "frame-src 'self'",
      "frame-ancestors 'self'",
      CONNECT_SRC,
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

const UPLOAD_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  async headers() {
    // Uploaded HTML documents carry their own fonts/CSS/scripts and render
    // only inside sandboxed iframes — the sandbox attribute is the security
    // boundary there, so they are exempt from the page CSP.
    return [
      { source: "/uploads/:path*", headers: UPLOAD_HEADERS },
      { source: "/((?!uploads).*)", headers: SECURITY_HEADERS },
    ];
  },
};

export default nextConfig;
