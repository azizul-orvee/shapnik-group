import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { getAppSession, type AppSession } from "@/lib/session";
import { canReadOrg, canWrite } from "@/lib/rbac";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export const badRequest = (message: string) => new ApiError(400, message);
export const notFound = (message = "Not found") => new ApiError(404, message);
export const conflict = (message: string) => new ApiError(409, message);

/** Wraps a route handler so thrown ApiError/ZodError become clean JSON responses. */
export function handler<Args extends unknown[]>(
  fn: (...args: Args) => Promise<NextResponse | Response>,
) {
  return async (...args: Args): Promise<NextResponse | Response> => {
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof ApiError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      if (error instanceof ZodError) {
        return NextResponse.json(
          { error: "Validation failed", issues: flattenIssues(error) },
          { status: 422 },
        );
      }
      console.error("[api]", error);
      return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
    }
  };
}

export function flattenIssues(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export async function parseBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    throw badRequest("Expected a JSON body");
  }
  return schema.parse(json);
}

async function sessionOrThrow(): Promise<AppSession> {
  const session = await getAppSession();
  if (!session) throw new ApiError(401, "Sign in to continue");
  return session;
}

/** Any signed-in user. */
export const requireApiSession = sessionOrThrow;

/** ADMIN, TREASURER or COMMITTEE. */
export async function requireApiOrgReader(): Promise<AppSession> {
  const session = await sessionOrThrow();
  if (!canReadOrg(session.role)) throw new ApiError(403, "You do not have access to this");
  return session;
}

/** ADMIN or TREASURER. */
export async function requireApiWriter(): Promise<AppSession> {
  const session = await sessionOrThrow();
  if (!canWrite(session.role)) throw new ApiError(403, "Only admins and the treasurer can do this");
  return session;
}
