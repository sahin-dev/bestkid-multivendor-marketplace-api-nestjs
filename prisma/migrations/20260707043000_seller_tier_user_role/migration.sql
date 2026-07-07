-- Add seller tier as a dedicated seller capability field.
CREATE TYPE "SellerTier" AS ENUM ('BASIC_SELLER', 'STANDARD_SELLER', 'PREMIUM_SELLER');

ALTER TABLE "users"
ADD COLUMN "seller_tier" "SellerTier" NOT NULL DEFAULT 'BASIC_SELLER';

-- Every previous seller is now a normal user with seller capabilities.
UPDATE "users"
SET "role" = 'USER'
WHERE "role" = 'SELLER';

-- Recreate UserRole without SELLER. PostgreSQL cannot drop an enum value directly.
ALTER TYPE "UserRole" RENAME TO "UserRole_old";

CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

ALTER TABLE "users"
ALTER COLUMN "role" DROP DEFAULT;

ALTER TABLE "users"
ALTER COLUMN "role" TYPE "UserRole" USING ("role"::text::"UserRole");

ALTER TABLE "users"
ALTER COLUMN "role" SET DEFAULT 'USER';

DROP TYPE "UserRole_old";
