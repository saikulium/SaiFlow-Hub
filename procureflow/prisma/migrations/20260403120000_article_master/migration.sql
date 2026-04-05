CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateEnum
CREATE TYPE "AliasType" AS ENUM ('VENDOR', 'CLIENT', 'STANDARD');

-- AlterTable
ALTER TABLE "deploy_config" ADD COLUMN     "article_config" JSONB;

-- AlterTable
ALTER TABLE "invoice_line_items" ADD COLUMN     "article_id" TEXT;

-- AlterTable
ALTER TABLE "materials" ADD COLUMN     "article_id" TEXT;

-- AlterTable
ALTER TABLE "request_items" ADD COLUMN     "article_id" TEXT,
ADD COLUMN     "unresolved_code" TEXT;

-- CreateTable
CREATE TABLE "articles" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "unit_of_measure" TEXT NOT NULL,
    "manufacturer" TEXT,
    "manufacturer_code" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "tags" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "article_aliases" (
    "id" TEXT NOT NULL,
    "article_id" TEXT NOT NULL,
    "alias_type" "AliasType" NOT NULL,
    "alias_code" TEXT NOT NULL,
    "alias_label" TEXT,
    "entity_id" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "article_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "article_prices" (
    "id" TEXT NOT NULL,
    "article_id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "min_quantity" INTEGER NOT NULL DEFAULT 1,
    "valid_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_until" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'manual',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "article_prices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "articles_code_key" ON "articles"("code");

-- CreateIndex
CREATE INDEX "articles_name_idx" ON "articles"("name");

-- CreateIndex
CREATE INDEX "articles_category_idx" ON "articles"("category");

-- CreateIndex
CREATE INDEX "articles_manufacturer_code_idx" ON "articles"("manufacturer_code");

-- CreateIndex
CREATE INDEX "articles_is_active_idx" ON "articles"("is_active");

-- CreateIndex
CREATE INDEX "article_aliases_alias_code_idx" ON "article_aliases"("alias_code");

-- CreateIndex
CREATE INDEX "article_aliases_article_id_idx" ON "article_aliases"("article_id");

-- CreateIndex
CREATE INDEX "article_aliases_entity_id_idx" ON "article_aliases"("entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "article_aliases_alias_type_alias_code_entity_id_key" ON "article_aliases"("alias_type", "alias_code", "entity_id");

-- CreateIndex
CREATE INDEX "article_prices_article_id_vendor_id_idx" ON "article_prices"("article_id", "vendor_id");

-- CreateIndex
CREATE INDEX "article_prices_vendor_id_idx" ON "article_prices"("vendor_id");

-- AddForeignKey
ALTER TABLE "article_aliases" ADD CONSTRAINT "article_aliases_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_prices" ADD CONSTRAINT "article_prices_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "article_prices" ADD CONSTRAINT "article_prices_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_items" ADD CONSTRAINT "request_items_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "materials" ADD CONSTRAINT "materials_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Trigram index for fuzzy search on alias codes
CREATE INDEX idx_article_aliases_trgm ON "article_aliases" USING gin ("alias_code" gin_trgm_ops);
