ALTER TABLE "Project"
  ALTER COLUMN "budget" DROP DEFAULT,
  ALTER COLUMN "budget" TYPE DECIMAL(15,2)
    USING (
      CASE
        WHEN "budget" IS NULL OR trim("budget") = '' THEN 0
        ELSE "budget"::numeric
      END
    ),
  ALTER COLUMN "budget" SET DEFAULT 0,
  ALTER COLUMN "budget" SET NOT NULL;