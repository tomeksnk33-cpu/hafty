import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Trasa pralni to statyczna aplikacja w public/pralnia. Logowanie sprawdza
  // proxy.ts tak samo jak dla reszty stron.
  async rewrites() {
    return [{ source: "/pralnia", destination: "/pralnia/index.html" }];
  },
  images: {
    remotePatterns: [
      {
        // Publiczne pliki z Vercel Blob (produkcja).
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
    ],
  },
};

export default nextConfig;
