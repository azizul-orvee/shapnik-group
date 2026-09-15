import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Raster of the society emblem for @react-pdf, which cannot embed SVG.
 * Hoisted at module load so each statement render does not hit the disk
 * (`server-hoist-static-io`). Keep the file in the serverless trace via
 * `outputFileTracingIncludes` in `next.config.ts`.
 */
export const SOCIETY_LOGO_PNG = readFileSync(
  join(process.cwd(), "src/components/pdf/assets/logo.png"),
);
