-- CreateEnum
CREATE TYPE "DigestFrequency" AS ENUM ('IMMEDIATE', 'EVERY_15_MIN', 'HOURLY', 'DAILY');

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "email_overrides" JSONB NOT NULL DEFAULT '{}',
    "inapp_overrides" JSONB NOT NULL DEFAULT '{}',
    "digest_enabled" BOOLEAN NOT NULL DEFAULT true,
    "digest_frequency" "DigestFrequency" NOT NULL DEFAULT 'HOURLY',
    "digest_quiet_hours_start" INTEGER DEFAULT 20,
    "digest_quiet_hours_end" INTEGER DEFAULT 8,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_user_id_key" ON "notification_preferences"("user_id");

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
