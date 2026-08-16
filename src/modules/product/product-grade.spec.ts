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
});
