import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @react-pdf/renderer and the Postgres driver must run as real Node modules
  // rather than being bundled into the server build.
  serverExternalPackages: ["@react-pdf/renderer", "pg"],
  // The statement letterhead reads this PNG from disk at runtime.
  outputFileTracingIncludes: {
    "/api/reports/**/*": ["./src/components/pdf/assets/**/*"],
  },
};

export default nextConfig;
