-- CreateEnum
CREATE TYPE "OrderConfirmationSource" AS ENUM ('EMAIL', 'WEBHOOK', 'MANUAL', 'IMPORT');

-- CreateEnum
CREATE TYPE "OrderConfirmationStatus" AS ENUM ('RECEIVED', 'PARSED', 'ACKNOWLEDGED', 'APPLIED', 'REJECTED');

-- AlterTable: per-line delivery dates on RequestItem (all nullable, no backfill)
ALTER TABLE "request_items" ADD COLUMN     "expected_delivery" TIMESTAMP(3),
ADD COLUMN     "confirmed_delivery" TIMESTAMP(3),
ADD COLUMN     "actual_delivery" TIMESTAMP(3);

-- AlterTable: link attachments to confirmations (optional)
ALTER TABLE "attachments" ADD COLUMN     "order_confirmation_id" TEXT;

-- CreateTable
CREATE TABLE "order_confirmations" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "email_log_id" TEXT,
    "source" "OrderConfirmationSource" NOT NULL DEFAULT 'MANUAL',
    "status" "OrderConfirmationStatus" NOT NULL DEFAULT 'RECEIVED',
    "subject" TEXT,
    "vendor_reference" TEXT,
    "received_at" TIMESTAMP(3),
    "parsed_at" TIMESTAMP(3),
    "acknowledged_at" TIMESTAMP(3),
    "applied_at" TIMESTAMP(3),
    "applied_by" TEXT,
    "rejected_at" TIMESTAMP(3),
    "rejected_by" TEXT,
    "rejection_reason" TEXT,
    "notes" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_confirmations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_confirmation_lines" (
    "id" TEXT NOT NULL,
    "confirmation_id" TEXT NOT NULL,
    "request_item_id" TEXT,
    "original_name" TEXT,
    "original_quantity" INTEGER,
    "original_unit" TEXT,
    "original_unit_price" DECIMAL(12,2),
    "original_expected_delivery" TIMESTAMP(3),
    "confirmed_name" TEXT,
    "confirmed_quantity" INTEGER,
    "confirmed_unit" TEXT,
    "confirmed_unit_price" DECIMAL(12,2),
    "confirmed_delivery" TIMESTAMP(3),
    "confirmed_sku" TEXT,
    "price_delta_pct" DECIMAL(7,4),
    "delivery_delay_days" INTEGER,
    "applied" BOOLEAN NOT NULL DEFAULT false,
    "applied_at" TIMESTAMP(3),
    "rejected" BOOLEAN NOT NULL DEFAULT false,
    "rejected_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_confirmation_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "order_confirmations_request_id_status_idx" ON "order_confirmations"("request_id", "status");

-- CreateIndex
CREATE INDEX "order_confirmations_email_log_id_idx" ON "order_confirmations"("email_log_id");

-- CreateIndex
CREATE INDEX "order_confirmations_status_created_at_idx" ON "order_confirmations"("status", "created_at");

-- CreateIndex
CREATE INDEX "order_confirmation_lines_confirmation_id_idx" ON "order_confirmation_lines"("confirmation_id");

-- CreateIndex
CREATE INDEX "order_confirmation_lines_request_item_id_idx" ON "order_confirmation_lines"("request_item_id");

-- CreateIndex
CREATE INDEX "attachments_order_confirmation_id_idx" ON "attachments"("order_confirmation_id");

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_order_confirmation_id_fkey" FOREIGN KEY ("order_confirmation_id") REFERENCES "order_confirmations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_confirmations" ADD CONSTRAINT "order_confirmations_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "purchase_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_confirmation_lines" ADD CONSTRAINT "order_confirmation_lines_confirmation_id_fkey" FOREIGN KEY ("confirmation_id") REFERENCES "order_confirmations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_confirmation_lines" ADD CONSTRAINT "order_confirmation_lines_request_item_id_fkey" FOREIGN KEY ("request_item_id") REFERENCES "request_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
