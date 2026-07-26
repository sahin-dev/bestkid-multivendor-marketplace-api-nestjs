-- Track external LegitGrails product authentication submissions and results.
CREATE TABLE "product_authentication_requests" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'LEGITGRAILS',
    "externalOrderId" TEXT,
    "status" TEXT NOT NULL,
    "verdict" TEXT,
    "certificateUrl" TEXT,
    "reportUrl" TEXT,
    "submittedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "rawRequest" JSONB,
    "rawResponse" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_authentication_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "product_authentication_requests_productId_idx"
ON "product_authentication_requests"("productId");

CREATE INDEX "product_authentication_requests_externalOrderId_idx"
ON "product_authentication_requests"("externalOrderId");

ALTER TABLE "product_authentication_requests"
ADD CONSTRAINT "product_authentication_requests_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
