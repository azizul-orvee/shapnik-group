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
import { DesktopTable, MobileList, MobileListItem } from "@/components/app/mobile-list";
import { requireOrgReader } from "@/lib/session";
import { canWrite } from "@/lib/rbac";
import { formatDate } from "@/lib/dates";
import { listMembers } from "@/server/members";

export const metadata: Metadata = { title: "Members" };

export default async function MembersPage({ searchParams }: PageProps<"/members">) {
  const session = await requireOrgReader();
  const params = await searchParams;
  const search = typeof params.q === "string" ? params.q.trim() : "";

  const members = await listMembers(session.organizationId, {
    search: search || undefined,
  });
  const writable = canWrite(session.role);

  return (
    <>
      <PageHeader
        title="Members"
        description={`${members.length} ${members.length === 1 ? "member" : "members"}`}
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

      <form className="mb-4 flex gap-2" action="/members">
        <div className="relative min-w-0 flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            name="q"
            defaultValue={search}
            placeholder="Search name, ID or phone"
            className="h-11 pl-9 md:h-8"
            aria-label="Search members"
          />
        </div>
        <Button type="submit" variant="secondary" className="h-11 md:h-8">
          Search
        </Button>
      </form>

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
        <>
          <MobileList>
            {members.map((member) => (
              <MobileListItem
                key={member.id}
                href={`/members/${member.id}`}
                title={member.name}
                subtitle={
                  <>
                    <span className="font-mono">{member.memberId}</span>
                    {member.phone ? ` · ${member.phone}` : ""}
                  </>
                }
                trailing={
                  <span className="text-muted-foreground text-[11px]">{formatDate(member.joinDate)}</span>
                }
              />
            ))}
          </MobileList>
          <DesktopTable>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Joined</TableHead>
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
                    </TableCell>
                    <TableCell>{member.phone ?? "—"}</TableCell>
                    <TableCell>{formatDate(member.joinDate)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DesktopTable>
        </>
      )}
    </>
  );
}
