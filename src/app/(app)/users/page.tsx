import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/app/page-header";
import { requireSession } from "@/lib/session";
import { canManageUsers, ROLE_LABELS } from "@/lib/rbac";
import { listUsers } from "@/server/users";
import { formatDate } from "@/lib/dates";

export const metadata: Metadata = { title: "Accounts" };

export default async function UsersPage() {
  const session = await requireSession();
  if (!canManageUsers(session.role)) redirect("/dashboard");

  const users = await listUsers(session.organizationId);

  return (
    <>
      <PageHeader
        title="Accounts"
        description="Every sign-in for this society. Member logins are created with the member."
      />

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Sign-in ID</TableHead>
              <TableHead className="hidden md:table-cell">Linked member</TableHead>
              <TableHead className="hidden sm:table-cell">Created</TableHead>
              <TableHead className="text-right">Role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">
                  {user.name}
                  <span className="text-muted-foreground block font-mono text-xs sm:hidden">
                    {user.username ?? "—"}
                  </span>
                </TableCell>
                <TableCell className="font-mono text-xs">{user.username ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground hidden md:table-cell">
                  {user.member ? `${user.member.memberId} — ${user.member.name}` : "—"}
                </TableCell>
                <TableCell className="text-muted-foreground hidden text-xs sm:table-cell">
                  {formatDate(user.createdAt)}
                </TableCell>
                <TableCell className="text-right">
                  <Badge variant={user.role === "ADMIN" ? "default" : "secondary"}>
                    {ROLE_LABELS[user.role]}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <p className="text-muted-foreground mt-3 text-xs">
        Everyone signs in with their ID and their NID. Adding a member creates their
        login automatically.
      </p>
    </>
  );
}
