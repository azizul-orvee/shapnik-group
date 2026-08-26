import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader, EmptyState } from "@/components/app/page-header";
import { MemberStatusBadge } from "@/components/app/member-badges";
import { requireOrgReader } from "@/lib/session";
import { canWrite } from "@/lib/rbac";
import { formatDate } from "@/lib/dates";
import { listMembers } from "@/server/members";
import type { MemberStatus } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Members" };

export default async function MembersPage({ searchParams }: PageProps<"/members">) {
  const session = await requireOrgReader();
  const params = await searchParams;

  const rawStatus = typeof params.status === "string" ? params.status : undefined;
  const status: MemberStatus | undefined =
    rawStatus === "ACTIVE" || rawStatus === "INACTIVE" ? rawStatus : undefined;
  const search = typeof params.q === "string" ? params.q.trim() : "";

  const members = await listMembers(session.organizationId, {
    status,
    search: search || undefined,
  });
  const writable = canWrite(session.role);

  return (
    <>
      <PageHeader
        title="Members"
        description={`${members.length} ${members.length === 1 ? "member" : "members"}${
          status ? ` · ${status.toLowerCase()} only` : ""
        }`}
        action={
          writable ? (
            <Button asChild size="sm">
              <Link href="/members/new">
                <Plus className="size-4" />
                Add member
              </Link>
            </Button>
          ) : null
        }
      />

      <form className="mb-4 flex flex-wrap gap-2" action="/members">
        <div className="relative min-w-48 flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            name="q"
            defaultValue={search}
            placeholder="Search name, ID or phone"
            className="pl-9"
            aria-label="Search members"
          />
        </div>
        {status ? <input type="hidden" name="status" value={status} /> : null}
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      <div className="mb-4 flex gap-2">
        {[
          { label: "All", value: undefined },
          { label: "Active", value: "ACTIVE" },
          { label: "Inactive", value: "INACTIVE" },
        ].map((tab) => {
          const href = new URLSearchParams();
          if (search) href.set("q", search);
          if (tab.value) href.set("status", tab.value);
          const query = href.toString();
          return (
            <Button
              key={tab.label}
              asChild
              size="sm"
              variant={status === tab.value ? "default" : "outline"}
            >
              <Link href={query ? `/members?${query}` : "/members"}>{tab.label}</Link>
            </Button>
          );
        })}
      </div>

      {members.length === 0 ? (
        <EmptyState
          title="No members found"
          description={
            search
              ? "Try a different search term."
              : "Add the society's members to start recording contributions."
          }
          action={
            writable && !search ? (
              <Button asChild size="sm">
                <Link href="/members/new">Add the first member</Link>
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="hidden sm:table-cell">Phone</TableHead>
                <TableHead className="hidden md:table-cell">Joined</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-mono text-xs">{member.memberId}</TableCell>
                  <TableCell>
                    <Link
                      href={`/members/${member.id}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {member.name}
                    </Link>
                    <span className="text-muted-foreground block text-xs sm:hidden">
                      {member.phone ?? "No phone"}
                    </span>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">{member.phone ?? "—"}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    {formatDate(member.joinDate)}
                  </TableCell>
                  <TableCell className="text-right">
                    <MemberStatusBadge status={member.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
