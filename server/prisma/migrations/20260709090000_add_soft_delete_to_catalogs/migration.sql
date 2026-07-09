ALTER TABLE "service_categories"
ADD COLUMN "is_deleted" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "services"
ADD COLUMN "is_deleted" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "device_types"
ADD COLUMN "is_deleted" BOOLEAN NOT NULL DEFAULT false;
