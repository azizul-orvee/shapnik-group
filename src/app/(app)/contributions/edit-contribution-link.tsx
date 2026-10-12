import Link from "next/link";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Opens the correction screen for one payment, returning to `back` afterwards. */
export function EditContributionLink({
  contributionId,
  label,
  back,
}: {
  contributionId: string;
  label: string;
  back: string;
}) {
  return (
    <Button asChild variant="ghost" size="icon" className="size-11 md:size-8">
      <Link
        href={`/contributions/${contributionId}/edit?back=${encodeURIComponent(back)}`}
        aria-label={`Correct payment: ${label}`}
      >
        <Pencil className="size-4" />
      </Link>
    </Button>
  );
}
