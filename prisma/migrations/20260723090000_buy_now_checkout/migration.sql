-- Store Stripe Checkout session IDs on direct Buy Now orders so webhook retries do not create duplicates.
ALTER TABLE "orders"
ADD COLUMN "stripe_checkout_session_id" TEXT;

CREATE UNIQUE INDEX "orders_stripe_checkout_session_id_key"
ON "orders"("stripe_checkout_session_id");
