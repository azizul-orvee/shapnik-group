import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * The Shapnik society logo. The artwork is a multicolour circular emblem on a
 * transparent ground, so it sits on a small white badge — that keeps it reading
 * exactly as designed in both light and dark themes rather than dropping its
 * white plate onto a dark surface.
 */
export function BrandMark({
  className,
  size = 36,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <span
      className={cn(
        "ring-border/70 inline-flex items-center justify-center overflow-hidden rounded-full bg-white shadow-sm ring-1",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <Image
        src="/logo.svg"
        alt="Shapnik"
        width={size}
        height={size}
        priority
        className="size-full object-contain p-[8%]"
      />
    </span>
  );
}
