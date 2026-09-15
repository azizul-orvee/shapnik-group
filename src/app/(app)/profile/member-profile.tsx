function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b py-3 last:border-b-0">
      <dt className="text-muted-foreground shrink-0 text-sm">{label}</dt>
      <dd className={`min-w-0 text-right text-sm ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}

/** Read-only view of a member's registered details. NID stays masked. No inputs. */
export function MemberProfileView({
  memberId,
  name,
  phone,
  nationalId,
  nomineeName,
  nomineeNationalId,
  nomineePhone,
}: {
  memberId: string;
  name: string;
  phone: string;
  nationalId: string;
  nomineeName: string;
  nomineeNationalId: string;
  nomineePhone: string | null;
}) {
  return (
    <div className="max-w-lg space-y-4">
      <dl className="rounded-xl bg-card px-4 ring-1 ring-foreground/10">
        <Row label="Sign-in ID" value={memberId} mono />
        <Row label="Full name" value={name} />
        <Row label="Phone" value={phone} />
        <Row label="National ID (NID)" value={nationalId} mono />
      </dl>

      <section className="rounded-xl bg-card px-4 ring-1 ring-foreground/10">
        <h2 className="text-muted-foreground pt-3 text-xs font-medium tracking-wide uppercase">
          Nominee
        </h2>
        <dl>
          <Row label="Name" value={nomineeName} />
          <Row label="NID" value={nomineeNationalId} mono />
          <Row label="Phone" value={nomineePhone ?? "—"} />
        </dl>
      </section>
    </div>
  );
}
