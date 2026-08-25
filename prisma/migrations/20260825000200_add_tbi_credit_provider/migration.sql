ALTER TYPE "PaymentProvider" ADD VALUE IF NOT EXISTS 'TBI_CREDIT';

ALTER TYPE "CurrencyPreference" ADD VALUE IF NOT EXISTS 'RON';

ALTER TABLE "payment_transactions"
ADD COLUMN "provider_reference_id" TEXT,
ADD COLUMN "provider_application_id" TEXT,
ADD COLUMN "provider_redirect_url" TEXT,
ADD COLUMN "provider_status" TEXT,
ADD COLUMN "provider_payload" JSONB;

CREATE UNIQUE INDEX "payment_transactions_provider_reference_id_key" ON "payment_transactions"("provider_reference_id");
CREATE UNIQUE INDEX "payment_transactions_provider_application_id_key" ON "payment_transactions"("provider_application_id");
CREATE INDEX "payment_transactions_provider_reference_id_idx" ON "payment_transactions"("provider_reference_id");
CREATE INDEX "payment_transactions_provider_application_id_idx" ON "payment_transactions"("provider_application_id");
CREATE INDEX "payment_transactions_provider_status_idx" ON "payment_transactions"("provider_status");
