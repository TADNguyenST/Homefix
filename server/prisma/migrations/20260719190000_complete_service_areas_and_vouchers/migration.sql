-- Preserve existing service-area data while clarifying operational terminology.
ALTER TYPE "DistrictType" RENAME VALUE 'QUAN' TO 'CORE';
ALTER TYPE "DistrictType" RENAME VALUE 'HUYEN' TO 'EXTENDED';
ALTER TYPE "WardType" ADD VALUE IF NOT EXISTS 'DAC_KHU';

ALTER TABLE "districts"
  ADD COLUMN "province_code" INTEGER,
  ADD COLUMN "province_name" VARCHAR(100),
  ADD COLUMN "parent_id" INTEGER,
  ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "wards"
  ADD COLUMN "external_code" INTEGER,
  ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "districts"
  ADD CONSTRAINT "districts_parent_id_fkey"
  FOREIGN KEY ("parent_id") REFERENCES "districts"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "districts_name_key" ON "districts"("name");
CREATE INDEX "districts_province_code_is_active_idx" ON "districts"("province_code", "is_active");
CREATE INDEX "districts_parent_id_idx" ON "districts"("parent_id");
CREATE UNIQUE INDEX "wards_external_code_key" ON "wards"("external_code");
CREATE UNIQUE INDEX "wards_district_id_name_key" ON "wards"("district_id", "name");
CREATE INDEX "wards_district_id_is_active_idx" ON "wards"("district_id", "is_active");
CREATE UNIQUE INDEX "voucher_usages_voucher_id_user_id_key" ON "voucher_usages"("voucher_id", "user_id");
