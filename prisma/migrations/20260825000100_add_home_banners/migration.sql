CREATE TABLE "home_banners" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "description" TEXT,
    "image_url" TEXT NOT NULL,
    "button_text" TEXT NOT NULL DEFAULT 'Shop Now',
    "categoryId" INTEGER,
    "subCategoryId" INTEGER,
    "couponId" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "home_banners_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "home_banners_is_active_idx" ON "home_banners"("is_active");
CREATE INDEX "home_banners_sort_order_idx" ON "home_banners"("sort_order");
CREATE INDEX "home_banners_categoryId_idx" ON "home_banners"("categoryId");
CREATE INDEX "home_banners_subCategoryId_idx" ON "home_banners"("subCategoryId");
CREATE INDEX "home_banners_couponId_idx" ON "home_banners"("couponId");

ALTER TABLE "home_banners" ADD CONSTRAINT "home_banners_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "home_banners" ADD CONSTRAINT "home_banners_subCategoryId_fkey" FOREIGN KEY ("subCategoryId") REFERENCES "sub_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "home_banners" ADD CONSTRAINT "home_banners_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "coupons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
