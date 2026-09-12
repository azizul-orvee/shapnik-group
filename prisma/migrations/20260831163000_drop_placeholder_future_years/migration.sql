-- 2027 is not pre-created; the admin adds it when they are ready.

DELETE FROM "YearPlan" yp
WHERE yp.year >= 2027
  AND NOT EXISTS (
    SELECT 1
    FROM "Contribution" c
    WHERE c."organizationId" = yp."organizationId"
      AND c."paidForYear" = yp.year
  );

UPDATE "Organization" o
SET "endMonth" = COALESCE(
  (SELECT MAX(yp."endMonth") FROM "YearPlan" yp WHERE yp."organizationId" = o."id"),
  o."endMonth"
);
