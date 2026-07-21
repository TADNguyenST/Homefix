-- Du lieu seed cu la cac vung nghiep vu cua thanh pho Can Tho sau sap nhap.
UPDATE "districts"
SET "province_code" = 92,
    "province_name" = 'Thành phố Cần Thơ'
WHERE "province_code" IS NULL;

UPDATE "districts" AS extended_area
SET "parent_id" = core_area."id"
FROM "districts" AS core_area
WHERE extended_area."type" = 'EXTENDED'
  AND extended_area."parent_id" IS NULL
  AND core_area."type" = 'CORE'
  AND core_area."province_code" = extended_area."province_code";
