-- AlterTable
ALTER TABLE "users"
ADD COLUMN "is_locked" BOOLEAN NOT NULL DEFAULT false;

-- Chuyển dữ liệu nếu phiên bản cũ từng khóa bằng tiền tố trong password_hash.
UPDATE "users"
SET
  "is_locked" = true,
  "is_active" = true,
  "password_hash" = SUBSTRING("password_hash" FROM 8)
WHERE "password_hash" LIKE 'BANNED:%';
