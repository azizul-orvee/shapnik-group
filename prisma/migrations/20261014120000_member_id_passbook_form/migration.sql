-- Store numeric member IDs in passbook form: "32", "m32", "M-032" -> "M-32",
-- matching formatMemberCode() in src/lib/member-id.ts. Non-numeric IDs are
-- left alone. A member's login username is their member ID, so it moves too.

UPDATE "Member"
SET "memberId" = 'M-' || lpad(
  regexp_replace(upper("memberId"), '^M?-?0*([0-9]+)$', '\1'),
  2, '0'
)
WHERE upper("memberId") ~ '^M?-?[0-9]+$'
  AND length(regexp_replace(upper("memberId"), '^M?-?0*([0-9]+)$', '\1')) <= 2;

-- lpad() truncates, so IDs of three or more digits are handled separately.
UPDATE "Member"
SET "memberId" = 'M-' || regexp_replace(upper("memberId"), '^M?-?0*([0-9]+)$', '\1')
WHERE upper("memberId") ~ '^M?-?[0-9]+$'
  AND length(regexp_replace(upper("memberId"), '^M?-?0*([0-9]+)$', '\1')) > 2;

UPDATE "User" u
SET "username" = m."memberId"
FROM "Member" m
WHERE u."memberId" = m.id
  AND u."role" = 'MEMBER'
  AND u."username" IS DISTINCT FROM m."memberId";
