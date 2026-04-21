-- CreateEnum
CREATE TYPE "LineDeliveryStatus" AS ENUM ('CONFIRMED', 'PARTIAL', 'BACKORDERED', 'UNAVAILABLE', 'SHIPPED', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('PENDING', 'SHIPPED', 'DELIVERED', 'RETURNED', 'LOST', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ShipmentSource" AS ENUM ('MANUAL', 'EMAIL', 'DDT_PARSING', 'API');

-- AlterEnum
ALTER TYPE "OrderConfirmationStatus" ADD VALUE 'PARTIALLY_APPLIED';

-- AlterTable
ALTER TABLE "order_confirmation_lines" ADD COLUMN     "applied_by" TEXT,
ADD COLUMN     "delivery_status" "LineDeliveryStatus" NOT NULL DEFAULT 'CONFIRMED',
ADD COLUMN     "rejected_by" TEXT,
ADD COLUMN     "rejected_reason" TEXT;

-- AlterTable
ALTER TABLE "request_items" ADD COLUMN     "delivery_status" "LineDeliveryStatus" NOT NULL DEFAULT 'CONFIRMED';

-- CreateTable
CREATE TABLE "request_item_shipments" (
    "id" TEXT NOT NULL,
    "request_item_id" TEXT NOT NULL,
    "shipped_quantity" DECIMAL(12,4) NOT NULL,
    "expected_ship_date" TIMESTAMP(3),
    "actual_ship_date" TIMESTAMP(3),
    "expected_delivery_date" TIMESTAMP(3),
    "actual_delivery_date" TIMESTAMP(3),
    "tracking_number" TEXT,
    "carrier" TEXT,
    "tracking_url" TEXT,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "source" "ShipmentSource" NOT NULL DEFAULT 'MANUAL',
    "source_email_log_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "request_item_shipments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "request_item_shipments_request_item_id_idx" ON "request_item_shipments"("request_item_id");

-- CreateIndex
CREATE INDEX "request_item_shipments_status_idx" ON "request_item_shipments"("status");

-- CreateIndex
CREATE INDEX "request_item_shipments_tracking_number_idx" ON "request_item_shipments"("tracking_number");

-- CreateIndex
CREATE INDEX "order_confirmation_lines_delivery_status_idx" ON "order_confirmation_lines"("delivery_status");

-- CreateIndex
CREATE INDEX "request_items_delivery_status_idx" ON "request_items"("delivery_status");

-- AddForeignKey
ALTER TABLE "request_item_shipments" ADD CONSTRAINT "request_item_shipments_request_item_id_fkey" FOREIGN KEY ("request_item_id") REFERENCES "request_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

