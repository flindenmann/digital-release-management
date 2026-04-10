-- AlterTable: milestoneCounter auf Release
ALTER TABLE "Release" ADD COLUMN "milestoneCounter" INTEGER NOT NULL DEFAULT 0;

-- AlterTable: key + applicationSnapshotId auf Milestone
-- Da bestehende Zeilen existieren könnten, erstmal nullable, dann NOT NULL setzen
ALTER TABLE "Milestone" ADD COLUMN "key" TEXT;
ALTER TABLE "Milestone" ADD COLUMN "applicationSnapshotId" TEXT;

-- Bestehende Zeilen mit Platzhalter-Werten befüllen (leere DB in Dev)
-- In Produktion würde man hier eine Daten-Migration schreiben
UPDATE "Milestone" SET "key" = 'MS-0000', "applicationSnapshotId" = (
  SELECT "id" FROM "ApplicationSnapshot" WHERE "releaseId" = "Milestone"."releaseId" LIMIT 1
) WHERE "key" IS NULL;

-- NOT NULL Constraints setzen
ALTER TABLE "Milestone" ALTER COLUMN "key" SET NOT NULL;
ALTER TABLE "Milestone" ALTER COLUMN "applicationSnapshotId" SET NOT NULL;

-- Unique Constraint: (releaseId, key)
CREATE UNIQUE INDEX "Milestone_releaseId_key_key" ON "Milestone"("releaseId", "key");

-- Index auf applicationSnapshotId
CREATE INDEX "Milestone_applicationSnapshotId_idx" ON "Milestone"("applicationSnapshotId");

-- Foreign Key: Milestone.applicationSnapshotId → ApplicationSnapshot.id
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_applicationSnapshotId_fkey"
  FOREIGN KEY ("applicationSnapshotId") REFERENCES "ApplicationSnapshot"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
