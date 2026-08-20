import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import bcrypt from "bcrypt";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to seed the database.");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

type SeedUser = Awaited<ReturnType<typeof upsertUser>>;
type SeedCategory = {
  id: number;
  subCategories: { id: number }[];
};

const password = "Password123!";

const categoryData = [
  {
    name: "Toys & Games",
    description: "Playful toys, games, and puzzles for kids.",
    image_url: "/uploads/category.webp",
    subCategories: ["Action Figures", "Board Games", "Puzzles"],
  },
  {
    name: "Books & Education",
    description: "Learning books and educational activities.",
    image_url: "/uploads/category.webp",
    subCategories: ["Picture Books", "Activity Books", "Learning Kits"],
  },
  {
    name: "Clothing & Accessories",
    description: "Everyday clothes, shoes, and accessories for children.",
    image_url: "/uploads/category.webp",
    subCategories: ["Boys Clothing", "Girls Clothing", "Shoes & Boots"],
  },
];

const adminUser = {
  email: "test_admin@yopmail.com",
  full_name: "BestKid Admin",
  phone: "+359 88 000 0000",
  country: "Bulgaria",
};

const sellerUsers = [
  {
    email: "basic.seller@bestkid.test",
    full_name: "Emily Carter",
    phone: "+359 88 123 4567",
    country: "Bulgaria",
    seller_tier: "BASIC_SELLER" as const,
    stripe_account_id: "acct_seed_basic",
    domestic_partner: "Bulgarian Post",
    domestic_cost: 4.99,
    domestic_days_min: 2,
    domestic_days_max: 4,
    international_partner: "DHL Express",
    international_cost: 12.99,
    international_days_min: 5,
    international_days_max: 10,
  },
  {
    email: "standard.seller@bestkid.test",
    full_name: "John Miller",
    phone: "+359 88 234 5678",
    country: "Bulgaria",
    seller_tier: "STANDARD_SELLER" as const,
    stripe_account_id: "acct_seed_standard",
    domestic_partner: "Speedy",
    domestic_cost: 5.49,
    domestic_days_min: 1,
    domestic_days_max: 3,
    international_partner: "DPD",
    international_cost: 14.5,
    international_days_min: 4,
    international_days_max: 8,
  },
  {
    email: "premium.seller@bestkid.test",
    full_name: "Chris Brown",
    phone: "+359 88 345 6789",
    country: "Bulgaria",
    seller_tier: "PREMIUM_SELLER" as const,
    stripe_account_id: "acct_seed_premium",
    domestic_partner: "Econt",
    domestic_cost: 3.99,
    domestic_days_min: 1,
    domestic_days_max: 2,
    international_partner: "FedEx",
    international_cost: 18.99,
    international_days_min: 3,
    international_days_max: 6,
  },
];

const buyerUsers = [
  {
    email: "buyer.one@bestkid.test",
    full_name: "Thomas Baker",
    phone: "+359 77 123 4567",
    country: "Bulgaria",
  },
  {
    email: "buyer.two@bestkid.test",
    full_name: "Robert Davis",
    phone: "+359 77 234 5678",
    country: "Romania",
  },
  {
    email: "buyer.three@bestkid.test",
    full_name: "Amelia Wilson",
    phone: "+359 77 345 6789",
    country: "Bulgaria",
  },
];

const legitGrailsSeedScenarios: Array<{
  label: string;
  authenticationStatus: "NOT_SUBMITTED" | "PENDING" | "VERIFIED" | "NOT_VERIFIED";
  requestStatus: string | null;
  verdict: string | null;
  productStatus: "ACTIVE" | "INACTIVE";
  rawResponse?: Record<string, any> | null;
  certificateUrl?: string;
}> = [
  {
    label: "not-submitted",
    authenticationStatus: "NOT_SUBMITTED",
    requestStatus: null,
    verdict: null,
    productStatus: "INACTIVE",
    rawResponse: null,
  },
  {
    label: "queued",
    authenticationStatus: "PENDING",
    requestStatus: "queued",
    verdict: null,
    productStatus: "INACTIVE",
    rawResponse: {
      id: "LG-QUEUED-001",
      delivery_id: "del_queued_001",
      status: "queued",
      outcome: null,
    },
  },
  {
    label: "processing",
    authenticationStatus: "PENDING",
    requestStatus: "processing",
    verdict: null,
    productStatus: "INACTIVE",
    rawResponse: {
      id: "LG-PROCESSING-001",
      delivery_id: "del_processing_001",
      status: "processing",
      outcome: null,
    },
  },
  {
    label: "update-photos",
    authenticationStatus: "PENDING",
    requestStatus: "update-photos",
    verdict: null,
    productStatus: "INACTIVE",
    rawResponse: {
      id: "LG-UPDATE-PHOTOS-001",
      delivery_id: "del_update_photos_001",
      status: "update-photos",
      outcome: null,
      photos_to_resubmit: [
        { index_code: "overall-picture", reason: "The image is too blurry." },
        { index_code: "serial-number", reason: "The serial number is not readable." },
      ],
    },
  },
  {
    label: "verified",
    authenticationStatus: "VERIFIED",
    requestStatus: "completed",
    verdict: "authentic",
    productStatus: "ACTIVE",
    certificateUrl: "https://cdn.legitgrails.com/certificates/verified-001.pdf",
    rawResponse: {
      id: "LG-VERIFIED-001",
      delivery_id: "del_verified_001",
      status: "completed",
      outcome: "authentic",
      certificate_url: "https://cdn.legitgrails.com/certificates/verified-001.pdf",
    },
  },
  {
    label: "fake",
    authenticationStatus: "NOT_VERIFIED",
    requestStatus: "completed",
    verdict: "fake",
    productStatus: "INACTIVE",
    rawResponse: {
      id: "LG-FAKE-001",
      delivery_id: "del_fake_001",
      status: "completed",
      outcome: "fake",
      outcome_reasons: ["The serial number does not match the product record."],
    },
  },
  {
    label: "unable-to-verify",
    authenticationStatus: "NOT_VERIFIED",
    requestStatus: "completed",
    verdict: "unable-to-verify",
    productStatus: "INACTIVE",
    rawResponse: {
      id: "LG-UNABLE-TO-VERIFY-001",
      delivery_id: "del_unable_verify_001",
      status: "completed",
      outcome: "unable-to-verify",
      outcome_reasons: ["The supplied images did not contain enough detail to verify authenticity."],
    },
  },
  {
    label: "error",
    authenticationStatus: "PENDING",
    requestStatus: "error",
    verdict: null,
    productStatus: "INACTIVE",
    rawResponse: {
      id: "LG-ERROR-001",
      delivery_id: "del_error_001",
      status: "error",
      outcome: null,
      error: "Image ingestion failed during processing.",
    },
  },
];

async function main() {
  console.log("Starting BestKid seed...");

  const hashedPassword = await bcrypt.hash(password, 10);
  const categories = await seedCategories();
  const admin = await upsertUser({
    ...adminUser,
    password: hashedPassword,
    role: "ADMIN",
  });

  const buyers: SeedUser[] = [];
  for (const buyer of buyerUsers) {
    buyers.push(
      await upsertUser({
        ...buyer,
        password: hashedPassword,
        role: "USER",
      }),
    );
  }

  const sellers: SeedUser[] = [];
  for (const seller of sellerUsers) {
    const user = await upsertUser({
      ...seller,
      password: hashedPassword,
      role: "USER",
      stripe_onboarding_complete: true,
    });
    sellers.push(user);
    await seedDeliveryOptions(user.id, seller);
    await seedAccountAddresses(user.id, seller.country);
  }

  const products = await seedProducts(sellers, categories);
  await seedLegitGrailsProductFlows(sellers, products);
  const orderItems = await seedOrdersAndReturns(sellers, buyers, products);
  await seedReturnRequests(orderItems);
  await seedBuyerCommerce(buyers, sellers, products);
  await seedProductReviews(orderItems);
  await seedChats(sellers, buyers);
  await seedNotifications(admin.id, sellers, buyers);
  await seedCoupons(categories);
  await seedContentAndSupport(buyers);
  await seedFaqs();

  console.log("Seed complete.");
  console.log(`Login password for seeded users: ${password}`);
  console.log(`Admin: ${adminUser.email}`);
  console.log(`Sellers: ${sellerUsers.map((seller) => seller.email).join(", ")}`);
  console.log(`Buyers: ${buyerUsers.map((buyer) => buyer.email).join(", ")}`);
}

async function seedCategories() {
  const categories: SeedCategory[] = [];

  for (const categoryInput of categoryData) {
    let category = await prisma.category.findFirst({
      where: { name: categoryInput.name },
      include: { subCategories: true },
    });

    if (!category) {
      category = await prisma.category.create({
        data: {
          name: categoryInput.name,
          description: categoryInput.description,
          image_url: categoryInput.image_url,
          subCategories: {
            create: categoryInput.subCategories.map((name) => ({
              name,
              description: `${name} for kids`,
            })),
          },
        },
        include: { subCategories: true },
      });
    }

    categories.push(category);
  }

  return categories;
}

async function upsertUser(input: {
  email: string;
  password: string;
  full_name: string;
  phone: string;
  country: string;
  role: "USER" | "ADMIN";
  seller_tier?: "BASIC_SELLER" | "STANDARD_SELLER" | "PREMIUM_SELLER";
  stripe_account_id?: string;
  stripe_onboarding_complete?: boolean;
}) {
  const user = await prisma.baseUser.upsert({
    where: { email: input.email },
    update: {
      role: input.role,
      seller_tier: input.seller_tier ?? "BASIC_SELLER",
      stripe_account_id: input.stripe_account_id,
      stripe_onboarding_complete: input.stripe_onboarding_complete ?? false,
      email_verifird: true,
    },
    create: {
      email: input.email,
      password: input.password,
      email_verifird: true,
      role: input.role,
      seller_tier: input.seller_tier ?? "BASIC_SELLER",
      stripe_account_id: input.stripe_account_id,
      stripe_onboarding_complete: input.stripe_onboarding_complete ?? false,
    },
  });

  const profile = await prisma.profile.upsert({
    where: { userId: user.id },
    update: {
      full_name: input.full_name,
      phone: input.phone,
      country: input.country,
      avatar_url: `https://i.pravatar.cc/150?u=${encodeURIComponent(input.email)}`,
    },
    create: {
      full_name: input.full_name,
      phone: input.phone,
      country: input.country,
      avatar_url: `https://i.pravatar.cc/150?u=${encodeURIComponent(input.email)}`,
      userId: user.id,
    },
  });

  return prisma.baseUser.update({
    where: { id: user.id },
    data: { profile_id: profile.id },
    include: { profile: true },
  });
}

async function seedDeliveryOptions(
  sellerId: number,
  seller: (typeof sellerUsers)[number],
) {
  await prisma.sellerDeliveryOption.upsert({
    where: { sellerId },
    update: {
      domestic_partner: seller.domestic_partner,
      domestic_cost: seller.domestic_cost,
      domestic_days_min: seller.domestic_days_min,
      domestic_days_max: seller.domestic_days_max,
      international_partner: seller.international_partner,
      international_cost: seller.international_cost,
      international_days_min: seller.international_days_min,
      international_days_max: seller.international_days_max,
    },
    create: {
      sellerId,
      domestic_partner: seller.domestic_partner,
      domestic_cost: seller.domestic_cost,
      domestic_days_min: seller.domestic_days_min,
      domestic_days_max: seller.domestic_days_max,
      international_partner: seller.international_partner,
      international_cost: seller.international_cost,
      international_days_min: seller.international_days_min,
      international_days_max: seller.international_days_max,
    },
  });
}

async function seedAccountAddresses(sellerId: number, country: string) {
  const existingAddress = await prisma.userAddress.findFirst({
    where: { userId: sellerId, address_name: "Store" },
  });

  if (existingAddress) {
    return;
  }

  await prisma.userAddress.create({
    data: {
      userId: sellerId,
      address_name: "Store",
      address: "25 Ivan Vazov Street",
      city: "Plovdiv",
      postal_code: "4000",
      country,
      is_default: true,
    },
  });
}

async function seedProducts(
  sellers: SeedUser[],
  categories: SeedCategory[],
) {
  const products: Record<number, { id: number; price: number }[]> = {};

  for (const seller of sellers) {
    products[seller.id] = [];

    for (let index = 0; index < 4; index++) {
      const category = categories[index % categories.length];
      const subCategory = category.subCategories[index % category.subCategories.length];
      const name = `${seller.profile?.full_name ?? "Seller"} Kids Item ${index + 1}`;
      const authenticationStatus = index === 3 ? "NOT_VERIFIED" : index % 2 === 0 ? "VERIFIED" : "PENDING";
      const isAuthenticated = authenticationStatus === "VERIFIED";
      const moderatedAt = new Date(Date.now() - (index + 1) * 24 * 60 * 60 * 1000);
      const existing = await prisma.product.findFirst({
        where: { userId: seller.id, name },
      });

      if (existing) {
        await prisma.product.update({
          where: { id: existing.id },
          data: {
            status: existing.status === "SOLD" ? existing.status : isAuthenticated ? "ACTIVE" : "INACTIVE",
            authentication_status: authenticationStatus,
            is_authenticated: isAuthenticated,
            approved_at: authenticationStatus === "VERIFIED" ? (existing.approved_at ?? moderatedAt) : null,
            rejected_at: authenticationStatus === "NOT_VERIFIED" ? (existing.rejected_at ?? moderatedAt) : null,
          },
        });
        products[seller.id].push({
          id: existing.id,
          price: existing.discounted_price ?? existing.original_price,
        });
        continue;
      }

      const originalPrice = 18 + index * 7;
      const discountedPrice = index % 2 === 0 ? originalPrice - 3 : null;
      const brands = ["Nike", "Adidas", "Zara Kids", "H&M Kids"];
      const product = await prisma.product.create({
        data: {
          name,
          description: `Seeded product for ${seller.profile?.full_name ?? "seller"}. Size: ${index % 2 === 0 ? "M" : "L"}.`,
          brand: brands[index % brands.length],
          original_price: originalPrice,
          discounted_price: discountedPrice,
          discount_percentage: discountedPrice ? Math.round(((originalPrice - discountedPrice) / originalPrice) * 100) : null,
          image_urls: ["/uploads/shoes.jpg"],
          categoryId: category.id,
          subCategoryId: subCategory.id,
          userId: seller.id,
          condition: index % 2 === 0 ? "NEW" : "USED",
          status: isAuthenticated ? "ACTIVE" : "INACTIVE",
          is_authenticated: isAuthenticated,
          authentication_status: authenticationStatus,
          approved_at: authenticationStatus === "VERIFIED" ? moderatedAt : null,
          rejected_at: authenticationStatus === "NOT_VERIFIED" ? moderatedAt : null,
        },
      });

      products[seller.id].push({
        id: product.id,
        price: discountedPrice ?? originalPrice,
      });
    }
  }

  return products;
}

async function seedLegitGrailsProductFlows(sellers: SeedUser[], products: Record<number, { id: number; price: number }[]>) {
  for (const seller of sellers) {
    const productBase = products[seller.id]?.[0];
    if (!productBase) {
      continue;
    }

    for (const scenario of legitGrailsSeedScenarios) {
      const scenarioAny = scenario as any;
      const productName = `${seller.profile?.full_name ?? "Seller"} LegitGrails ${scenario.label}`;
      const product = await prisma.product.findFirst({ where: { userId: seller.id, name: productName } });
      const category = await prisma.category.findFirst({ orderBy: { id: "asc" } });
      const subCategory = category ? await prisma.subCategory.findFirst({ where: { categoryId: category.id }, orderBy: { id: "asc" } }) : null;

      const productData = {
        name: productName,
        description: `LegitGrails ${scenario.label} scenario for ${seller.profile?.full_name ?? "seller"}.`,
        brand: ["Nike", "Adidas", "Zara Kids", "H&M Kids"][seller.id % 4],
        original_price: productBase.price + 10,
        discounted_price: productBase.price + 8,
        discount_percentage: 10,
        image_urls: ["/uploads/shoes.jpg"],
        categoryId: category?.id ?? 1,
        subCategoryId: subCategory?.id ?? 1,
        userId: seller.id,
        condition: "NEW" as const,
        status: scenario.productStatus,
        is_authenticated: scenario.authenticationStatus === "VERIFIED",
        authentication_status: scenario.authenticationStatus,
        approved_at: scenario.authenticationStatus === "VERIFIED" ? new Date() : null,
        rejected_at: scenario.authenticationStatus === "NOT_VERIFIED" ? new Date() : null,
      };

      const createdProduct = product
        ? await prisma.product.update({ where: { id: product.id }, data: productData })
        : await prisma.product.create({ data: productData });

      if (scenario.requestStatus) {
        const externalOrderId = `LEGIT-${createdProduct.id}-${scenario.label}`;
        const rawResponse = scenarioAny.rawResponse ?? null;
        const certificateUrl = scenarioAny.certificateUrl ?? null;
        const payload = {
          id: externalOrderId,
          delivery_id: `del_${createdProduct.id}_${scenario.label}`,
          status: scenario.requestStatus,
          outcome: scenario.verdict,
          ...(rawResponse?.photos_to_resubmit ? { photos_to_resubmit: rawResponse.photos_to_resubmit } : {}),
          ...(rawResponse?.outcome_reasons ? { outcome_reasons: rawResponse.outcome_reasons } : {}),
          ...(certificateUrl ? { certificate_url: certificateUrl } : {}),
        };

        const existingRequest = await prisma.productAuthenticationRequest.findFirst({
          where: {
            productId: createdProduct.id,
            provider: "LEGITGRAILS",
            externalOrderId,
          },
        });

        if (!existingRequest) {
          await prisma.productAuthenticationRequest.create({
            data: {
              productId: createdProduct.id,
              provider: "LEGITGRAILS",
              externalOrderId,
              status: scenario.requestStatus,
              verdict: scenario.verdict ?? null,
              certificateUrl: certificateUrl ?? null,
              image_urls: ["/uploads/shoes.jpg"],
              submittedAt: new Date(Date.now() - 60 * 60 * 1000),
              completedAt: scenario.requestStatus === "completed" ? new Date() : null,
              rawRequest: {
                external_id: `bestkid-product-${createdProduct.id}-${scenario.label}`,
                category_code: "bag",
                brand_code: "nike",
                answer_time: 720,
                photos: [{ index_code: "overall-picture", url: "/uploads/shoes.jpg" }],
              },
              rawResponse: payload,
            },
          });
        }
      }
    }
  }
}

async function seedOrdersAndReturns(
  sellers: SeedUser[],
  buyers: SeedUser[],
  products: Record<number, { id: number; price: number }[]>,
) {
  const existingOrders = await prisma.order.count({
    where: { sellerId: { in: sellers.map((seller) => seller.id) } },
  });

  if (existingOrders > 0) {
    const existingOrderItems = await prisma.orderItem.findMany({
      where: { order: { sellerId: { in: sellers.map((seller) => seller.id) } } },
      select: { id: true, productId: true, order: { select: { userId: true } } },
      take: 8,
      orderBy: { createdAt: "asc" },
    });

    return existingOrderItems.map((item) => ({
      id: item.id,
      productId: item.productId,
      userId: item.order.userId,
    }));
  }

  const statuses = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"] as const;
  const createdOrderItems: { id: number; productId: number; userId: number }[] = [];

  for (const [sellerIndex, seller] of sellers.entries()) {
    const sellerProducts = products[seller.id];

    for (let orderIndex = 0; orderIndex < 5; orderIndex++) {
      const buyer = buyers[(sellerIndex + orderIndex) % buyers.length];
      const product = sellerProducts[orderIndex % sellerProducts.length];
      const deliveryCost = orderIndex % 2 === 0 ? 4.99 : 12.99;
      const total = product.price + deliveryCost;
      const createdAt = new Date();
      createdAt.setDate(createdAt.getDate() - orderIndex * 3 - sellerIndex);

      const order = await prisma.order.create({
        data: {
          userId: buyer.id,
          sellerId: seller.id,
          status: statuses[orderIndex % statuses.length],
          total,
          delivery_partner: orderIndex % 2 === 0 ? "Bulgarian Post" : "DHL Express",
          delivery_cost: deliveryCost,
          delivery_days_min: orderIndex % 2 === 0 ? 2 : 5,
          delivery_days_max: orderIndex % 2 === 0 ? 4 : 10,
          shippingAddress: "25 Ivan Vazov Street",
          city: "Plovdiv",
          postalCode: "4000",
          country: buyer.profile?.country ?? "Bulgaria",
          createdAt,
          items: {
            create: [
              {
                productId: product.id,
                price: product.price,
              },
            ],
          },
        },
        include: { items: true },
      });

      if (order.items[0]) {
        createdOrderItems.push({ id: order.items[0].id, productId: product.id, userId: buyer.id });
      }
    }
  }

  return createdOrderItems;
}

async function seedReturnRequests(
  orderItems: { id: number; productId: number; userId: number }[],
) {
  const existingReturns = await prisma.returnRequest.count();

  if (existingReturns > 0) {
    console.log(`Skipping return request seeding: ${existingReturns} return requests already exist.`);
    return;
  }

  if (orderItems.length === 0) {
    console.log("No order items available for seeding return requests.");
    return;
  }

  // Define diverse return request scenarios
  const returnScenarios = [
    {
      reason: "Size did not fit",
      message: "The item arrived in the specified size but it's too small for my child.",
      status: "PENDING" as const,
      images: ["/uploads/return-1.jpg"],
      seller_response: null,
      seller_rejection_reason: null,
      return_address: "Return Center, 123 Return Street, Sofia 1000, Bulgaria",
      resolved_at: null,
      completed_at: null,
      refunded_at: null,
      refund_amount: null,
    },
    {
      reason: "Item arrived damaged",
      message: "The packaging was torn and the item inside has visible scratches and damage.",
      status: "APPROVED" as const,
      images: ["/uploads/return-damage-1.jpg", "/uploads/return-damage-2.jpg"],
      seller_response: "Sorry to hear about the damage. We will send a replacement immediately.",
      seller_rejection_reason: null,
      return_address: "Return Center, 123 Return Street, Sofia 1000, Bulgaria",
      resolved_at: new Date(new Date().getTime() - 2 * 24 * 60 * 60 * 1000),
      completed_at: null,
      refunded_at: null,
      refund_amount: null,
    },
    {
      reason: "Item does not match description",
      message: "The color in the photos looks different from what arrived. The product is much darker.",
      status: "PROCESSING" as const,
      images: ["/uploads/return-mismatch.jpg"],
      seller_response: "We apologize for the color discrepancy. We're processing your return now.",
      seller_rejection_reason: null,
      return_address: "Return Center, 123 Return Street, Sofia 1000, Bulgaria",
      resolved_at: new Date(new Date().getTime() - 1 * 24 * 60 * 60 * 1000),
      completed_at: null,
      refunded_at: null,
      refund_amount: null,
    },
    {
      reason: "Changed mind",
      message: "I don't think my child will enjoy this toy as much as I initially thought.",
      status: "REJECTED" as const,
      images: [],
      seller_response: null,
      seller_rejection_reason: "Change of mind returns are not eligible for refund per our policy.",
      return_address: null,
      resolved_at: new Date(new Date().getTime() - 3 * 24 * 60 * 60 * 1000),
      completed_at: null,
      refunded_at: null,
      refund_amount: null,
    },
    {
      reason: "Defective product",
      message: "The wheels don't roll smoothly and there's a defect in the frame.",
      status: "COMPLETED" as const,
      images: ["/uploads/return-defect-1.jpg"],
      seller_response: "Thank you for returning the defective item. Full refund has been processed.",
      seller_rejection_reason: null,
      return_address: "Return Center, 123 Return Street, Sofia 1000, Bulgaria",
      resolved_at: new Date(new Date().getTime() - 5 * 24 * 60 * 60 * 1000),
      completed_at: new Date(new Date().getTime() - 4 * 24 * 60 * 60 * 1000),
      refunded_at: new Date(new Date().getTime() - 3 * 24 * 60 * 60 * 1000),
      refund_amount: 29.99,
    },
    {
      reason: "Missing parts",
      message: "The package arrived incomplete. It's missing several pieces that were listed.",
      status: "APPROVED" as const,
      images: ["/uploads/return-missing.jpg"],
      seller_response: "We apologize for the missing parts. We're sending them separately at no cost.",
      seller_rejection_reason: null,
      return_address: null,
      resolved_at: new Date(new Date().getTime() - 2 * 24 * 60 * 60 * 1000),
      completed_at: null,
      refunded_at: null,
      refund_amount: null,
    },
    {
      reason: "Quality not as expected",
      message: "The material quality is poor for the price. It feels cheap and fragile.",
      status: "PENDING" as const,
      images: ["/uploads/return-quality.jpg"],
      seller_response: null,
      seller_rejection_reason: null,
      return_address: "Return Center, 123 Return Street, Sofia 1000, Bulgaria",
      resolved_at: null,
      completed_at: null,
      refunded_at: null,
      refund_amount: null,
    },
    {
      reason: "Allergic reaction",
      message: "My child developed a rash after wearing this. We suspect it's due to the material.",
      status: "APPROVED" as const,
      images: ["/uploads/return-allergy.jpg"],
      seller_response: "We're very sorry to hear this. For your safety, we're processing a full refund.",
      seller_rejection_reason: null,
      return_address: "Return Center, 123 Return Street, Sofia 1000, Bulgaria",
      resolved_at: new Date(new Date().getTime() - 1 * 24 * 60 * 60 * 1000),
      completed_at: null,
      refunded_at: null,
      refund_amount: null,
    },
  ];

  // Create return requests for available order items
  for (let i = 0; i < Math.min(returnScenarios.length, orderItems.length); i++) {
    const scenario = returnScenarios[i];
    const orderItem = orderItems[i];

    await prisma.returnRequest.create({
      data: {
        orderItemId: orderItem.id,
        userId: orderItem.userId,
        reason: scenario.reason,
        message: scenario.message,
        images: scenario.images,
        status: scenario.status,
        seller_response: scenario.seller_response,
        seller_rejection_reason: scenario.seller_rejection_reason,
        return_address: scenario.return_address,
        resolved_at: scenario.resolved_at,
        completed_at: scenario.completed_at,
        refunded_at: scenario.refunded_at,
        refund_amount: scenario.refund_amount,
      },
    });
  }

  console.log(`Seeded ${Math.min(returnScenarios.length, orderItems.length)} return requests.`);
}

async function seedBuyerCommerce(
  buyers: SeedUser[],
  sellers: SeedUser[],
  products: Record<number, { id: number; price: number }[]>,
) {
  const allProducts = sellers.flatMap((seller) => products[seller.id] ?? []);

  for (const [buyerIndex, buyer] of buyers.entries()) {
    const cart = await prisma.cart.upsert({
      where: { userId: buyer.id },
      update: {},
      create: { userId: buyer.id },
    });

    const selectedProducts = [
      allProducts[buyerIndex % allProducts.length],
      allProducts[(buyerIndex + 3) % allProducts.length],
    ].filter(Boolean);

    for (const product of selectedProducts) {
      await prisma.cartItem.upsert({
        where: { cartId_productId: { cartId: cart.id, productId: product.id } },
        update: {},
        create: {
          cartId: cart.id,
          productId: product.id,
        },
      });

      await prisma.wishlistItem.upsert({
        where: { userId_productId: { userId: buyer.id, productId: product.id } },
        update: {},
        create: { userId: buyer.id, productId: product.id },
      });

      await prisma.recentlyView.upsert({
        where: { userId_productId: { userId: buyer.id, productId: product.id } },
        update: { viewedAt: new Date() },
        create: { userId: buyer.id, productId: product.id },
      });
    }
  }
}

async function seedProductReviews(orderItems: { id: number; productId: number; userId: number }[]) {
  const reviewInputs = orderItems.slice(0, 6).map((item, index) => ({
    productId: item.productId,
    userId: item.userId,
    orderItemId: item.id,
    rating: 5 - (index % 2),
    review: index % 2 === 0
      ? "Great quality and exactly as described."
      : "Nice product, fast delivery, and good packaging.",
  }));

  for (const review of reviewInputs) {
    await prisma.productReview.upsert({
      where: { orderItemId: review.orderItemId },
      update: {
        rating: review.rating,
        review: review.review,
      },
      create: review,
    });
  }

  const reviewedProductIds = [...new Set(reviewInputs.map((review) => review.productId))];
  for (const productId of reviewedProductIds) {
    const aggregate = await prisma.productReview.aggregate({
      where: { productId },
      _count: { id: true },
      _avg: { rating: true },
    });

    await prisma.product.update({
      where: { id: productId },
      data: {
        total_reviews: aggregate._count.id,
        average_rating: aggregate._avg.rating ?? 0,
      },
    });
  }
}

async function seedChats(sellers: SeedUser[], buyers: SeedUser[]) {
  for (const [index, buyer] of buyers.entries()) {
    const seller = sellers[index % sellers.length];
    const room = await prisma.chatRoom.upsert({
      where: { buyerId_sellerId: { buyerId: buyer.id, sellerId: seller.id } },
      update: {},
      create: { buyerId: buyer.id, sellerId: seller.id },
    });

    const existingMessages = await prisma.chatMessage.count({ where: { chatRoomId: room.id } });
    if (existingMessages > 0) {
      continue;
    }

    await prisma.chatMessage.createMany({
      data: [
        {
          chatRoomId: room.id,
          senderId: buyer.id,
          message: "Hi, is this item still available?",
          is_delivered: true,
          type: "TEXT",
        },
        {
          chatRoomId: room.id,
          senderId: seller.id,
          message: "Yes, it is available and ready to ship.",
          is_delivered: true,
          is_read: true,
          type: "TEXT",
        },
      ],
    });
  }
}

async function seedNotifications(
  adminId: number,
  sellers: SeedUser[],
  buyers: SeedUser[],
) {
  const targetUsers = [adminId, ...sellers.map((seller) => seller.id), ...buyers.map((buyer) => buyer.id)];

  for (const userId of targetUsers) {
    const existing = await prisma.notification.findFirst({
      where: { userId, title: "Welcome to BestKid" },
    });

    if (existing) {
      continue;
    }

    await prisma.notification.create({
      data: {
        userId,
        title: "Welcome to BestKid",
        message: "Your seeded account is ready to use.",
        type: "OTHER",
      },
    });
  }
}

async function seedCoupons(categories: SeedCategory[]) {
  const now = new Date();
  const activeStart = new Date(now);
  activeStart.setDate(activeStart.getDate() - 5);
  const activeEnd = new Date(now);
  activeEnd.setDate(activeEnd.getDate() + 20);
  const expiredStart = new Date(now);
  expiredStart.setDate(expiredStart.getDate() - 40);
  const expiredEnd = new Date(now);
  expiredEnd.setDate(expiredEnd.getDate() - 10);

  const couponInputs = [
    {
      campaign_reason: "Christmas Sale",
      code: "KIDS10",
      categoryId: categories[0]?.id,
      subCategoryId: categories[0]?.subCategories[0]?.id,
      discount_type: "PERCENTAGE" as const,
      discount_value: 10,
      usage_type: "UNLIMITED" as const,
      usage_limit: null,
      used_count: 0,
      start_date: activeStart,
      end_date: activeEnd,
      is_active: true,
    },
    {
      campaign_reason: "Back to School",
      code: "BOOKS5",
      categoryId: categories[1]?.id,
      subCategoryId: categories[1]?.subCategories[1]?.id,
      discount_type: "FIXED_AMOUNT" as const,
      discount_value: 5,
      usage_type: "LIMITED" as const,
      usage_limit: 100,
      used_count: 18,
      start_date: activeStart,
      end_date: activeEnd,
      is_active: true,
    },
    {
      campaign_reason: "Spring Clearance",
      code: "SPRING15",
      categoryId: categories[2]?.id,
      subCategoryId: categories[2]?.subCategories[2]?.id,
      discount_type: "PERCENTAGE" as const,
      discount_value: 15,
      usage_type: "LIMITED" as const,
      usage_limit: 50,
      used_count: 50,
      start_date: expiredStart,
      end_date: expiredEnd,
      is_active: true,
    },
  ];

  for (const coupon of couponInputs) {
    await prisma.coupon.upsert({
      where: { code: coupon.code },
      update: coupon,
      create: coupon,
    });
  }
}

async function seedContentAndSupport(buyers: SeedUser[]) {
  await upsertLegalDocument(
    "TERMS_AND_CONDITIONS",
    [
      "Terms & Conditions",
      "Last Updated: 14 March 2026",
      "BestKid is a marketplace for buying and selling kids fashion and related items.",
      "Users must provide accurate product information, follow platform policies, and use secure payment methods.",
    ].join("\n\n"),
  );

  await upsertLegalDocument(
    "PRIVACY_POLICY",
    [
      "Privacy Policy",
      "Last Updated: 14 March 2026",
      "We collect account, profile, order, and transaction information to operate the platform.",
      "We do not sell personal data. Payment processing is handled by third-party providers.",
    ].join("\n\n"),
  );

  const company = await prisma.companyInfo.findFirst();
  const companyData = {
    company_name: "BestKid",
    business_type: "Online Marketplace Platform",
    contact_email: "support@bestkid.com",
    contact_address: "To be confirmed - Bulgaria",
    website: "https://www.bestkid.com",
    jurisdiction: "Bulgaria / European Union",
  };

  if (company) {
    await prisma.companyInfo.update({ where: { id: company.id }, data: companyData });
  } else {
    await prisma.companyInfo.create({ data: companyData });
  }

  const supportInputs = [
    {
      name: buyers[0]?.profile?.full_name ?? "Maria Gonzalez",
      email: buyers[0]?.email ?? "maria@example.com",
      phone: buyers[0]?.profile?.phone ?? "+359 77 111 1111",
      subject: "Notification Issue",
      message: "I am not receiving order notifications.",
      status: "TO_DO" as const,
    },
    {
      name: buyers[1]?.profile?.full_name ?? "Olivia Martinez",
      email: buyers[1]?.email ?? "olivia@example.com",
      phone: buyers[1]?.profile?.phone ?? "+359 77 222 2222",
      subject: "Rating Dispute",
      message: "I need help reviewing a disputed product rating.",
      reply: "The request has been reviewed and resolved.",
      status: "RESOLVED" as const,
    },
  ];

  for (const request of supportInputs) {
    const existing = await prisma.contactRequest.findFirst({
      where: { email: request.email, subject: request.subject },
    });

    if (existing) {
      await prisma.contactRequest.update({ where: { id: existing.id }, data: request });
    } else {
      await prisma.contactRequest.create({ data: request });
    }
  }
}

async function upsertLegalDocument(type: "TERMS_AND_CONDITIONS" | "PRIVACY_POLICY", content: string) {
  const existing = await prisma.legalDocument.findFirst({ where: { type } });

  if (existing) {
    await prisma.legalDocument.update({ where: { id: existing.id }, data: { content } });
  } else {
    await prisma.legalDocument.create({ data: { type, content } });
  }
}

async function seedFaqs() {
  const faqGroups = [
    {
      name: "Buying",
      faqs: [
        {
          question: "How do I place an order?",
          answer: "Add products to your cart or use Buy Now from the product details page, review the checkout summary, and complete payment through Stripe.",
        },
        {
          question: "Can I buy from multiple sellers?",
          answer: "Yes. Cart checkout groups selected items by seller and creates separate orders for each seller after payment.",
        },
      ],
    },
    {
      name: "Selling",
      faqs: [
        {
          question: "What do I need before listing products?",
          answer: "Complete Stripe onboarding and configure delivery settings before publishing products for buyers.",
        },
        {
          question: "Where can I see product orders?",
          answer: "Sellers can view received orders and filter orders associated with a specific product from the seller order endpoints.",
        },
      ],
    },
    {
      name: "Returns",
      faqs: [
        {
          question: "How do returns work?",
          answer: "Buyers can request a return for delivered order items. Sellers review the request and update the return status.",
        },
      ],
    },
  ];

  for (const group of faqGroups) {
    let category = await prisma.faqCategory.findFirst({ where: { name: group.name } });
    if (!category) {
      category = await prisma.faqCategory.create({ data: { name: group.name } });
    }

    for (const faq of group.faqs) {
      const existing = await prisma.faq.findFirst({
        where: { categoryId: category.id, question: faq.question },
      });

      if (existing) {
        await prisma.faq.update({ where: { id: existing.id }, data: faq });
      } else {
        await prisma.faq.create({
          data: {
            categoryId: category.id,
            ...faq,
          },
        });
      }
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
    await pool.end();
  })
  .catch(async (error) => {
    console.error("Seed failed:", error);
    await prisma.$disconnect();
    await pool.end();
    process.exit(1);
  });
