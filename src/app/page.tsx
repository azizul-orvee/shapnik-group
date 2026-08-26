import { redirect } from "next/navigation";
import { getAppSession } from "@/lib/session";
import { canReadOrg } from "@/lib/rbac";

export default async function Home() {
  const session = await getAppSession();
  if (!session) redirect("/login");
  redirect(canReadOrg(session.role) ? "/dashboard" : "/my-statement");
}
