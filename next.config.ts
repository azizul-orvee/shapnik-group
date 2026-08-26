import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @react-pdf/renderer and the Postgres driver must run as real Node modules
  // rather than being bundled into the server build.
  serverExternalPackages: ["@react-pdf/renderer", "pg"],
};

export default nextConfig;
