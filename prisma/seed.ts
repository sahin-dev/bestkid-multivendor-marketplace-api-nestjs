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
  email: "admin@bestkid.test",
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
  await seedOrdersAndReturns(sellers, buyers, products);
  await seedNotifications(admin.id, sellers, buyers);
  await seedCoupons(categories);
  await seedContentAndSupport(buyers);

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
      const product = await prisma.product.create({
        data: {
          name,
          description: `Seeded product for ${seller.profile?.full_name ?? "seller"}`,
          original_price: originalPrice,
          discounted_price: discountedPrice,
          discount_percentage: discountedPrice ? Math.round(((originalPrice - discountedPrice) / originalPrice) * 100) : null,
          image_urls: ["/uploads/shoes.jpg"],
          categoryId: category.id,
          subCategoryId: subCategory.id,
          userId: seller.id,
          condition: index % 2 === 0 ? "NEW" : "USED",
          status: "ACTIVE",
          is_authenticated: isAuthenticated,
          authentication_status: authenticationStatus,
          approved_at: authenticationStatus === "VERIFIED" ? moderatedAt : null,
          rejected_at: authenticationStatus === "NOT_VERIFIED" ? moderatedAt : null,
          variants: {
            create: [
              { variantName: "Small", price: originalPrice },
              { variantName: "Large", price: originalPrice + 4 },
            ],
          },
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

async function seedOrdersAndReturns(
  sellers: SeedUser[],
  buyers: SeedUser[],
  products: Record<number, { id: number; price: number }[]>,
) {
  const existingOrders = await prisma.order.count({
    where: { sellerId: { in: sellers.map((seller) => seller.id) } },
  });

  if (existingOrders > 0) {
    return;
  }

  const statuses = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"] as const;
  const createdOrderItems: { id: number; userId: number }[] = [];

  for (const [sellerIndex, seller] of sellers.entries()) {
    const sellerProducts = products[seller.id];

    for (let orderIndex = 0; orderIndex < 5; orderIndex++) {
      const buyer = buyers[(sellerIndex + orderIndex) % buyers.length];
      const product = sellerProducts[orderIndex % sellerProducts.length];
      const quantity = (orderIndex % 2) + 1;
      const deliveryCost = orderIndex % 2 === 0 ? 4.99 : 12.99;
      const total = product.price * quantity + deliveryCost;
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
                quantity,
                price: product.price,
              },
            ],
          },
        },
        include: { items: true },
      });

      if (order.items[0]) {
        createdOrderItems.push({ id: order.items[0].id, userId: buyer.id });
      }
    }
  }

  for (const [index, orderItem] of createdOrderItems.slice(0, 4).entries()) {
    await prisma.returnRequest.create({
      data: {
        orderItemId: orderItem.id,
        userId: orderItem.userId,
        reason: index % 2 === 0 ? "Size did not fit" : "Item arrived damaged",
        images: [],
        status: index === 0 ? "PENDING" : index === 1 ? "APPROVED" : "REJECTED",
      },
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
