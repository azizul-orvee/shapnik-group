/**
 * `prisma migrate` honours a `?schema=` in DATABASE_URL, but the pg driver does
 * not — it just connects and uses the search_path. Left alone, the CLI and the
 * running app would disagree about which Postgres schema they are using on any
 * deployment that is not on `public`.
 *
 * Pull the value out here so both sides read the same connection string.
 */
export function schemaFromDatabaseUrl(connectionString: string): string | undefined {
  try {
    const schema = new URL(connectionString).searchParams.get("schema");
    return schema && schema !== "public" ? schema : undefined;
  } catch {
    return undefined;
  }
}
