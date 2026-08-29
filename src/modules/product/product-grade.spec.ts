import { ProductService } from "./product.service";

describe("ProductService grade handling", () => {
  it("stores the product grade when creating a product", async () => {
    const prisma = {
      product: {
        create: jest.fn().mockResolvedValue({ id: 1, name: "School Bag", grade: "Grade 3" }),
      },
      baseUser: {
        findUnique: jest.fn().mockResolvedValue({
          id: 99,
          stripe_onboarding_complete: true,
          stripe_account_id: "acct_123",
          delivery_option: {
            domestic_partner: "DHL",
            domestic_cost: 10,
            domestic_days_min: 2,
            domestic_days_max: 5,
          },
        }),
      },
      category: { findUnique: jest.fn().mockResolvedValue({ id: 1 }) },
      subCategory: { findUnique: jest.fn().mockResolvedValue({ id: 2, categoryId: 1 }) },
    };

    const service = new ProductService(prisma as any, { create: jest.fn() } as any, { convert: jest.fn(), convertAsync: jest.fn(), convertPrice: jest.fn() } as any);

    await service.createProduct(99, {
      name: "School Bag",
      original_price: 25,
      categoryId: 1,
      subCategoryId: 2,
      grade: "Grade 3",
    } as any);

    expect(prisma.product.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ grade: "Grade 3" }),
      }),
    );
  });

  it("allows the owner to view their inactive product", async () => {
    const prisma = {
      product: {
        findUnique: jest.fn().mockResolvedValue({
          id: 42,
          userId: 7,
          status: "INACTIVE",
          name: "Hidden Item",
          categoryId: 1,
          subCategoryId: 2,
          image_urls: [],
          reviews: [],
          authentication_requests: [],
          user: {
            id: 7,
            email: "seller@example.com",
            seller_tier: null,
            stripe_onboarding_complete: true,
            profile: { full_name: "Seller", avatar_url: null, country: null },
            delivery_option: null,
          },
          category: null,
          subCategory: null,
          original_price: 25,
          discounted_price: null,
          effective_price: 25,
          condition: "NEW",
          brand: "BestKid",
          is_authenticated: true,
          authentication_status: "VERIFIED",
          approved_at: null,
          rejected_at: null,
          sold_at: null,
          total_reviews: 0,
          average_rating: 0,
          grade: "Grade 3",
          description: "Hidden item description",
          createdAt: new Date(),
          updatedAt: new Date(),
          views: 0,
          discount_percentage: null,
        }),
        update: jest.fn().mockResolvedValue({}),
        count: jest.fn().mockResolvedValue(1),
        aggregate: jest.fn().mockResolvedValue({ _avg: { average_rating: 0 }, _sum: { total_reviews: 0 } }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      recentlyView: { upsert: jest.fn().mockResolvedValue({}) },
      wishlistItem: { findUnique: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
      productReview: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
      orderItem: { count: jest.fn().mockResolvedValue(0) },
      order: { count: jest.fn().mockResolvedValue(0) },
      baseUser: { findUnique: jest.fn().mockResolvedValue({ currency_preference: "USD" }) },
    };

    const service = new ProductService(prisma as any, { create: jest.fn() } as any, { convert: jest.fn(), convertAsync: jest.fn(), convertPrice: jest.fn().mockResolvedValue(25) } as any);

    await expect(service.findProductById(42, 7)).resolves.toMatchObject({ id: 42, status: "INACTIVE" });
  });

  it("blocks other users from viewing inactive products", async () => {
    const prisma = {
      product: {
        findUnique: jest.fn().mockResolvedValue({
          id: 42,
          userId: 7,
          status: "INACTIVE",
          name: "Hidden Item",
          categoryId: 1,
          subCategoryId: 2,
          image_urls: [],
          reviews: [],
          authentication_requests: [],
          user: {
            id: 7,
            email: "seller@example.com",
            seller_tier: null,
            stripe_onboarding_complete: true,
            profile: { full_name: "Seller", avatar_url: null, country: null },
            delivery_option: null,
          },
          category: null,
          subCategory: null,
          original_price: 25,
          discounted_price: null,
          effective_price: 25,
          condition: "NEW",
          brand: "BestKid",
          is_authenticated: true,
          authentication_status: "VERIFIED",
          approved_at: null,
          rejected_at: null,
          sold_at: null,
          total_reviews: 0,
          average_rating: 0,
          grade: "Grade 3",
          description: "Hidden item description",
          createdAt: new Date(),
          updatedAt: new Date(),
          views: 0,
          discount_percentage: null,
        }),
        update: jest.fn().mockResolvedValue({}),
        count: jest.fn().mockResolvedValue(1),
        aggregate: jest.fn().mockResolvedValue({ _avg: { average_rating: 0 }, _sum: { total_reviews: 0 } }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      recentlyView: { upsert: jest.fn().mockResolvedValue({}) },
      wishlistItem: { findUnique: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
      productReview: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
      orderItem: { count: jest.fn().mockResolvedValue(0) },
      order: { count: jest.fn().mockResolvedValue(0) },
      baseUser: { findUnique: jest.fn().mockResolvedValue({ currency_preference: "USD" }) },
    };

    const service = new ProductService(prisma as any, { create: jest.fn() } as any, { convert: jest.fn(), convertAsync: jest.fn(), convertPrice: jest.fn().mockResolvedValue(25) } as any);

    await expect(service.findProductById(42, 9)).rejects.toThrow("Product with ID 42 not found");
  });
});
