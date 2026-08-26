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
import { listMembers } from "@/server/members";
import { AddUserButton } from "./users-client";

export const metadata: Metadata = { title: "Accounts" };

export default async function UsersPage() {
  const session = await requireSession();
  if (!canManageUsers(session.role)) redirect("/dashboard");

  const [users, members] = await Promise.all([
    listUsers(session.organizationId),
    listMembers(session.organizationId, { status: "ACTIVE" }),
  ]);

  return (
    <>
      <PageHeader
        title="Accounts"
        description="Logins for this society and what each one can see."
        action={
          <AddUserButton
            members={members.map((m) => ({ id: m.id, name: m.name, memberId: m.memberId }))}
          />
        }
      />

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="hidden sm:table-cell">Email</TableHead>
              <TableHead className="hidden md:table-cell">Linked member</TableHead>
              <TableHead className="text-right">Role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">
                  {user.name}
                  <span className="text-muted-foreground block text-xs sm:hidden">
                    {user.email}
                  </span>
                </TableCell>
                <TableCell className="hidden sm:table-cell">{user.email}</TableCell>
                <TableCell className="text-muted-foreground hidden md:table-cell">
                  {user.member ? `${user.member.memberId} — ${user.member.name}` : "—"}
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
    </>
  );
}
