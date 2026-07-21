-- Hợp nhất dữ liệu khu vực cũ vào địa giới hành chính API v2 của Cần Thơ.
DO $$
DECLARE
  target_district_id INTEGER;
  target_ward_id INTEGER;
BEGIN
  SELECT "id"
  INTO target_district_id
  FROM "districts"
  WHERE "province_code" = 92
    AND "name" = 'Cần Thơ'
  ORDER BY "id" DESC
  LIMIT 1;

  IF target_district_id IS NULL THEN
    RAISE NOTICE 'Không tìm thấy khu vực API Cần Thơ; bỏ qua bước chuyển dữ liệu cũ.';
    RETURN;
  END IF;

  INSERT INTO "wards" (
    "district_id", "external_code", "name", "type", "is_active", "created_at", "updated_at"
  ) VALUES
    (target_district_id, 31396, 'Xã Hiệp Hưng', 'XA', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (target_district_id, 31399, 'Xã Tân Bình', 'XA', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  ON CONFLICT ("external_code") DO NOTHING;

  SELECT "id"
  INTO target_ward_id
  FROM "wards"
  WHERE "district_id" = target_district_id
    AND "external_code" = 31183
  LIMIT 1;

  IF target_ward_id IS NULL THEN
    RAISE EXCEPTION 'Thiếu Phường Long Tuyền (mã 31183) trong dữ liệu API Cần Thơ.';
  END IF;

  -- Địa chỉ cũ không còn là nguồn chuẩn; booking vẫn giữ phần số nhà/đường.
  UPDATE "bookings"
  SET "customer_address_id" = NULL
  WHERE "district_id" IN (
    SELECT "id" FROM "districts"
    WHERE "province_code" = 92 AND "id" <> target_district_id
  );

  DELETE FROM "customer_addresses"
  WHERE "district_id" IN (
    SELECT "id" FROM "districts"
    WHERE "province_code" = 92 AND "id" <> target_district_id
  );

  UPDATE "bookings"
  SET "district_id" = target_district_id,
      "ward_id" = target_ward_id,
      "updated_at" = CURRENT_TIMESTAMP
  WHERE "district_id" IN (
    SELECT "id" FROM "districts"
    WHERE "province_code" = 92 AND "id" <> target_district_id
  );

  UPDATE "technician_profiles"
  SET "district_id" = target_district_id,
      "updated_at" = CURRENT_TIMESTAMP
  WHERE "district_id" IN (
    SELECT "id" FROM "districts"
    WHERE "province_code" = 92 AND "id" <> target_district_id
  );

  DELETE FROM "districts"
  WHERE "province_code" = 92
    AND "id" <> target_district_id;
END $$;
