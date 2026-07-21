-- Khu vuc phuc vu tu nay la tinh/thanh pho theo API hanh chinh hai cap.
ALTER TABLE "districts" DROP CONSTRAINT IF EXISTS "districts_parent_id_fkey";
DROP INDEX IF EXISTS "districts_parent_id_idx";
ALTER TABLE "districts" DROP COLUMN IF EXISTS "parent_id";
ALTER TABLE "districts" DROP COLUMN IF EXISTS "type";
DROP TYPE IF EXISTS "DistrictType";
