import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Trasa pralni i rejestrator czasu pracy to statyczne aplikacje w public/.
  // Logowanie sprawdza proxy.ts tak samo jak dla reszty stron.
  async rewrites() {
    return [
      { source: "/pralnia", destination: "/pralnia/index.html" },
      { source: "/rejestrator", destination: "/rejestrator/index.html" },
    ];
  },
  // Modele rozpoznawania twarzy (~7 MB) zmieniają się tylko z nową wersją aplikacji.
  async headers() {
    const week = [{ key: "Cache-Control", value: "private, max-age=604800" }];
    return [
      { source: "/rejestrator/model/:file*", headers: week },
      { source: "/rejestrator/face-api.js", headers: week },
    ];
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
