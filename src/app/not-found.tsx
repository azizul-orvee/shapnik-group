import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <div>
        <p className="text-muted-foreground text-sm font-medium">404</p>
        <h1 className="mt-1 text-2xl font-semibold">Page not found</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          The page you were looking for does not exist.
        </p>
      </div>
      <Button asChild>
        <Link href="/">Back to the dashboard</Link>
      </Button>
    </main>
  );
}
