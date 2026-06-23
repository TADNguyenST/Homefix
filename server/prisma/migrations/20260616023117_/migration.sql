-- AlterTable
ALTER TABLE "device_types" ADD COLUMN     "category_id" INTEGER;

-- AddForeignKey
ALTER TABLE "device_types" ADD CONSTRAINT "device_types_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "service_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
