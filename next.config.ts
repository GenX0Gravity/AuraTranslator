import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(self), geolocation=(), interest-cohort=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://apis.google.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://lh3.googleusercontent.com https://avatars.githubusercontent.com",
      "connect-src 'self' https://translation.googleapis.com https://libretranslate.com https://*.firebaseio.com https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://generativelanguage.googleapis.com http://localhost:8090 https://*.run.app",
      "media-src 'self' blob:",
      "worker-src 'self' blob:",
      "frame-src 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  output: "standalone", // Required for Docker/Cloud Run deployment
  compress: true,

  // Turbopack config (Next.js 16 default bundler)
  turbopack: {
    resolveAlias: {
      // Prevent server-only packages from being bundled client-side
      "firebase-admin": "firebase-admin",
    },
  },

  // Security headers on all routes
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },

  // Image optimization
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
    ],
  },

  // Mark server-only packages to prevent client bundling
  serverExternalPackages: ["mongoose", "firebase-admin"],
};

export default nextConfig;
