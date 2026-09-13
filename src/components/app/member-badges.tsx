import { Badge } from "@/components/ui/badge";

/**
 * Four states, not two: a month that has not started yet is "not due yet", a
 * payment made before that month began was paid in advance, and a month settled
 * for less than the rate is part paid — recorded, but still short.
 */
export function PaidBadge({
  paid,
  isFuture = false,
  paidInAdvance = false,
  short = false,
}: {
  paid: boolean;
  isFuture?: boolean;
  paidInAdvance?: boolean;
  short?: boolean;
}) {
  if (paid && short) {
    return <Badge className="bg-viz-warning hover:bg-viz-warning text-black">Part paid</Badge>;
  }
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
