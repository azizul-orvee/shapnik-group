import { Badge } from "@/components/ui/badge";
import type { MemberStatus } from "@/generated/prisma/enums";

export function MemberStatusBadge({ status }: { status: MemberStatus }) {
  return (
    <Badge variant={status === "ACTIVE" ? "secondary" : "outline"}>
      {status === "ACTIVE" ? "Active" : "Inactive"}
    </Badge>
  );
}

/**
 * Three states, not two: a month that has not started yet is "not due yet",
 * and a payment made before that month began was paid in advance.
 */
export function PaidBadge({
  paid,
  isFuture = false,
  paidInAdvance = false,
}: {
  paid: boolean;
  isFuture?: boolean;
  paidInAdvance?: boolean;
}) {
  if (paid) {
    return (
      <Badge className="bg-viz-good text-white hover:bg-viz-good">
        {paidInAdvance ? "Paid ahead" : "Paid"}
      </Badge>
    );
  }
  if (isFuture) return <Badge variant="outline">Not due yet</Badge>;
  return <Badge variant="destructive">Pending</Badge>;
}
