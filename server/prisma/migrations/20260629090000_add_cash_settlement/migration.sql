-- CreateEnum
CREATE TYPE "PaymentSettlementStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'SETTLED');

-- AlterTable
ALTER TABLE "payments"
ADD COLUMN "settlement_status" "PaymentSettlementStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
ADD COLUMN "settled_at" TIMESTAMP(3),
ADD COLUMN "settled_by" INTEGER,
ADD COLUMN "settlement_note" VARCHAR(500);

-- Các khoản tiền mặt đã thu trước migration phải được Admin đối soát lại.
UPDATE "payments"
SET "settlement_status" = 'PENDING'
WHERE "method" = 'CASH' AND "status" = 'PAID';

-- AddForeignKey
ALTER TABLE "payments"
ADD CONSTRAINT "payments_settled_by_fkey"
FOREIGN KEY ("settled_by") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "payments_method_status_settlement_status_idx"
ON "payments"("method", "status", "settlement_status");
