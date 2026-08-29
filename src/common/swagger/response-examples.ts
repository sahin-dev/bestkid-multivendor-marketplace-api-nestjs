import type { OpenAPIObject } from '@nestjs/swagger';

const HTTP_METHODS = [
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'options',
  'head',
] as const;

const successEnvelopeSchema = {
  type: 'object',
  required: ['success', 'statusCode', 'message', 'data'],
  properties: {
    success: { type: 'boolean', example: true },
    statusCode: { type: 'integer', example: 200 },
    message: { type: 'string', example: 'Request successful' },
    data: {
      oneOf: [
        { type: 'object', additionalProperties: true },
        {
          type: 'array',
          items: { type: 'object', additionalProperties: true },
        },
        { type: 'string' },
        { type: 'number' },
        { type: 'boolean' },
        { type: 'null' },
      ],
    },
    meta: {
      type: 'object',
      required: ['total', 'page', 'limit', 'pages'],
      properties: {
        total: { type: 'integer', example: 24 },
        page: { type: 'integer', example: 1 },
        limit: { type: 'integer', example: 10 },
        pages: { type: 'integer', example: 3 },
      },
    },
  },
};

const errorEnvelopeSchema = {
  type: 'object',
  required: ['success', 'message', 'url', 'statusCode'],
  properties: {
    success: { type: 'boolean', example: false },
    message: {
      oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
      example: 'Resource not found',
    },
    url: { type: 'string', example: '/products/999' },
    statusCode: { type: 'integer', example: 404 },
  },
};

const successExample = {
  success: true,
  statusCode: 200,
  message: 'Request successful',
  data: {
    id: 1,
    name: 'Kids Cotton Hoodie - Soft Fit',
  },
};

const createdExample = {
  success: true,
  statusCode: 201,
  message: 'Request successful',
  data: {
    id: 1,
    createdAt: '2026-07-09T10:15:30.000Z',
  },
};

const paginatedExample = {
  success: true,
  statusCode: 200,
  message: 'Request successful',
  data: [
    {
      id: 1,
      name: 'Kids Cotton Hoodie - Soft Fit',
    },
  ],
  meta: {
    total: 24,
    page: 1,
    limit: 10,
    pages: 3,
  },
};

const categoryExample = {
  id: 1,
  name: 'Kids',
  image_url: 'https://cdn.bestkid.test/categories/kids.png',
  createdAt: '2026-07-09T10:00:00.000Z',
  updatedAt: '2026-07-09T10:00:00.000Z',
};

const subCategoryExample = {
  id: 2,
  name: 'Kids Sneakers',
  image_url: 'https://cdn.bestkid.test/categories/kids-sneakers.png',
  categoryId: 1,
  createdAt: '2026-07-09T10:00:00.000Z',
  updatedAt: '2026-07-09T10:00:00.000Z',
};

const productBaseExample = {
  id: 1,
  name: 'Kids Cotton Hoodie - Soft Fit',
  description:
    'Comfortable and lightweight kids hoodie designed for everyday use.',
  brand: 'Zara Kids',
  original_price: 21.99,
  discounted_price: 18,
  discount_percentage: 18,
  image_urls: ['https://cdn.bestkid.test/products/hoodie-front.png'],
  categoryId: 1,
  subCategoryId: 2,
  userId: 7,
  condition: 'NEW',
  status: 'ACTIVE',
  views: 12,
  total_reviews: 5,
  average_rating: 4.9,
  is_authenticated: true,
  authentication_status: 'VERIFIED',
  approved_at: '2026-07-09T09:00:00.000Z',
  rejected_at: null,
  sold_at: null,
  createdAt: '2026-07-09T10:15:30.000Z',
  updatedAt: '2026-07-09T10:15:30.000Z',
};

const productWithRelationsExample = {
  ...productBaseExample,
  category: categoryExample,
  subCategory: subCategoryExample,
};

const publicProductExample = {
  ...productWithRelationsExample,
  user: {
    id: 7,
    profile: {
      full_name: 'Roberts Junior',
      avatar_url: 'https://cdn.bestkid.test/avatars/seller.png',
      country: 'Bulgaria',
    },
  },
  effective_price: 18,
  is_wishlisted: false,
};

const homeProductCardExample = {
  id: 1,
  name: 'Kids Cotton Hoodie - Soft Fit',
  original_price: 21.99,
  discounted_price: 18,
  discount_percentage: 18,
  image_urls: ['https://cdn.bestkid.test/products/hoodie-front.png'],
  average_rating: 4.9,
  total_reviews: 5,
  condition: 'NEW',
  category: { id: 1, name: 'Kids' },
  user: {
    id: 7,
    profile: {
      full_name: 'Roberts Junior',
      avatar_url: 'https://cdn.bestkid.test/avatars/seller.png',
    },
  },
  effective_price: 18,
  is_wishlisted: false,
};

const publicProductDetailExample = {
  ...productBaseExample,
  user: {
    id: 7,
    email: 'seller@example.com',
    seller_tier: 'BASIC_SELLER',
    stripe_onboarding_complete: true,
    profile: {
      full_name: 'Roberts Junior',
      avatar_url: 'https://cdn.bestkid.test/avatars/seller.png',
      country: 'Bulgaria',
    },
    delivery_option: {
      id: 3,
      sellerId: 7,
      domestic_partner: 'Speedy',
      domestic_cost: 4.99,
      domestic_days_min: 2,
      domestic_days_max: 4,
      international_partner: 'DHL Express',
      international_cost: 12.99,
      international_days_min: 6,
      international_days_max: 10,
      createdAt: '2026-07-09T10:00:00.000Z',
      updatedAt: '2026-07-09T10:00:00.000Z',
    },
  },
  category: categoryExample,
  subCategory: subCategoryExample,
  reviews: [
    {
      id: 15,
      productId: 1,
      userId: 22,
      orderItemId: 31,
      rating: 5,
      review: 'Very comfortable and lightweight.',
      createdAt: '2026-07-09T11:00:00.000Z',
      updatedAt: '2026-07-09T11:00:00.000Z',
      user: {
        id: 22,
        profile: {
          full_name: 'Maximilian Becker',
          avatar_url: 'https://cdn.bestkid.test/avatars/buyer.png',
        },
      },
    },
  ],
  effective_price: 18,
  is_wishlisted: false,
  seller_overview: {
    active_products: 4,
    items_sold: 16,
    average_rating: 4.9,
    total_reviews: 128,
  },
  related_products: [
    {
      ...productWithRelationsExample,
      id: 2,
      name: 'Kids Sneakers - Soft Fit',
      effective_price: 18,
      is_wishlisted: false,
    },
  ],
};

const sellerProductCardExample = {
  id: 1,
  name: 'Kids Cotton Hoodie - Soft Fit',
  status: 'ACTIVE',
  category: categoryExample,
  subCategory: subCategoryExample,
  image_urls: ['https://cdn.bestkid.test/products/hoodie-front.png'],
  image_url: 'https://cdn.bestkid.test/products/hoodie-front.png',
  original_price: 21.99,
  discounted_price: 18,
  effective_price: 18,
  discount_percentage: 18,
  average_rating: 4.9,
  total_reviews: 5,
  createdAt: '2026-07-09T10:15:30.000Z',
  updatedAt: '2026-07-09T10:15:30.000Z',
  actions: {
    can_view_details: true,
    can_update: true,
    can_mark_active: false,
    can_mark_inactive: true,
    can_delete: true,
  },
};

const sellerProductDetailExample = {
  ...sellerProductCardExample,
  description:
    'Comfortable and lightweight kids hoodie designed for everyday use.',
  condition: 'NEW',
  brand: 'Zara Kids',
  is_authenticated: false,
  authentication_status: 'PENDING',
  approved_at: null,
  rejected_at: null,
  sold_at: null,
  seller: {
    id: 7,
    email: 'seller@example.com',
    seller_tier: 'BASIC_SELLER',
    stripe_onboarding_complete: true,
    profile: {
      full_name: 'Roberts Junior',
      avatar_url: 'https://cdn.bestkid.test/avatars/seller.png',
      country: 'Bulgaria',
    },
  },
  reviews: [
    {
      id: 15,
      productId: 1,
      userId: 22,
      orderItemId: 31,
      rating: 5,
      review: 'Very comfortable and lightweight.',
      createdAt: '2026-07-09T11:00:00.000Z',
      updatedAt: '2026-07-09T11:00:00.000Z',
      user: {
        id: 22,
        profile: {
          full_name: 'Maximilian Becker',
          avatar_url: 'https://cdn.bestkid.test/avatars/buyer.png',
        },
      },
    },
  ],
  orders_count: 2,
};

const productReviewExample = {
  id: 15,
  productId: 1,
  userId: 22,
  orderItemId: 31,
  rating: 5,
  review: 'Very comfortable and lightweight.',
  createdAt: '2026-07-09T11:00:00.000Z',
  updatedAt: '2026-07-09T11:00:00.000Z',
};

const profileExample = {
  id: 4,
  avatar_url: 'https://cdn.bestkid.test/avatars/buyer.png',
  full_name: 'Roberts Junior',
  phone: '+359 77 123 4567',
  country: 'Bulgaria',
  userId: 22,
  createdAt: '2026-07-09T09:00:00.000Z',
  updatedAt: '2026-07-09T09:00:00.000Z',
};

const userExample = {
  id: 22,
  email: 'buyer@example.com',
  email_verifird: true,
  is_blocked: false,
  profile_id: 4,
  role: 'USER',
  stripe_account_id: null,
  stripe_onboarding_complete: false,
  language_preference: 'EN',
  currency_preference: 'EUR',
  seller_tier: 'BASIC_SELLER',
  createdAt: '2026-07-09T09:00:00.000Z',
  updatedAt: '2026-07-09T09:00:00.000Z',
  profile: profileExample,
};

const addressExample = {
  id: 5,
  userId: 22,
  address_name: 'Home',
  address: '25 Ivan Vazov Street',
  city: 'Plovdiv',
  postal_code: '4000',
  country: 'Bulgaria',
  is_default: true,
  createdAt: '2026-07-09T09:10:00.000Z',
  updatedAt: '2026-07-09T09:10:00.000Z',
};

const connectedAccountExample = {
  provider: 'stripe',
  connected: true,
  account_id: 'acct_123456789',
  onboarding_complete: true,
};

const deliveryOptionExample = {
  id: 3,
  sellerId: 7,
  domestic_partner: 'Speedy',
  domestic_cost: 4.99,
  domestic_days_min: 2,
  domestic_days_max: 4,
  international_partner: 'DHL Express',
  international_cost: 12.99,
  international_days_min: 6,
  international_days_max: 10,
  createdAt: '2026-07-09T10:00:00.000Z',
  updatedAt: '2026-07-09T10:00:00.000Z',
};

const cartItemExample = {
  id: 14,
  cartId: 3,
  productId: 1,
  createdAt: '2026-07-09T10:30:00.000Z',
  updatedAt: '2026-07-09T10:30:00.000Z',
};

const cartExample = {
  seller_groups: [
    {
      seller: {
        id: 7,
        name: 'Roberts Junior',
        country: 'Bulgaria',
      },
      delivery: {
        partner: 'Speedy',
        cost: 4.99,
        days_min: 2,
        days_max: 4,
        type: 'domestic',
      },
      items: [
        {
          id: 14,
          productId: 1,
          price: 18,
          product: {
            id: 1,
            name: 'Kids Cotton Hoodie - Soft Fit',
            image_urls: ['https://cdn.bestkid.test/products/hoodie-front.png'],
            status: 'ACTIVE',
          },
        },
      ],
      subtotal: 18,
      delivery_cost: 4.99,
      group_total: 22.99,
    },
  ],
  grand_total: 22.99,
};

const notificationExample = {
  id: 8,
  userId: 22,
  title: 'Order status updated',
  message: 'Your order has been shipped.',
  type: 'ORDER',
  isRead: false,
  createdAt: '2026-07-09T11:15:00.000Z',
  updatedAt: '2026-07-09T11:15:00.000Z',
};

const couponExample = {
  id: 6,
  campaign_reason: 'Summer kids fashion sale',
  code: 'KIDS20',
  categoryId: 1,
  subCategoryId: 2,
  discount_type: 'PERCENTAGE',
  discount_value: 20,
  usage_type: 'LIMITED',
  usage_limit: 100,
  used_count: 12,
  start_date: '2026-07-01T00:00:00.000Z',
  end_date: '2026-07-31T23:59:59.000Z',
  is_active: true,
  category: categoryExample,
  subCategory: subCategoryExample,
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-09T10:00:00.000Z',
};

const chatRoomExample = {
  id: 11,
  partner: {
    id: 7,
    name: 'Roberts Junior',
    email: 'seller@example.com',
    avatar_url: 'https://cdn.bestkid.test/avatars/seller.png',
    seller_tier: 'BASIC_SELLER',
  },
  lastMessage: {
    id: 19,
    chatRoomId: 11,
    senderId: 22,
    message: 'Could you please check?',
    type: 'TEXT',
    readAt: null,
    createdAt: '2026-07-09T12:30:00.000Z',
  },
  unread_count: 1,
  is_blocked: false,
  blocked_by_me: false,
  blocked_by_partner: false,
  blocked_at: null,
  deleted_for_me: false,
  messaging_available: true,
  unavailable_reason: null,
  createdAt: '2026-07-09T12:00:00.000Z',
  updatedAt: '2026-07-09T12:30:00.000Z',
};

const chatMessageExample = {
  id: 19,
  chatRoomId: 11,
  senderId: 22,
  message: 'Could you please check?',
  type: 'TEXT',
  readAt: null,
  createdAt: '2026-07-09T12:30:00.000Z',
  sender: {
    id: 22,
    email: 'buyer@example.com',
    profile: {
      full_name: 'Roberts Junior',
      avatar_url: 'https://cdn.bestkid.test/avatars/buyer.png',
    },
  },
};

const orderItemExample = {
  id: 31,
  productId: 1,
  price: 260,
  line_total: 260,
  product: {
    id: 1,
    name: 'Kolev and Kolev - Soft Fit',
    image_urls: ['https://cdn.bestkid.test/products/shoes-front.png'],
    image_url: 'https://cdn.bestkid.test/products/shoes-front.png',
    average_rating: 4.9,
    total_reviews: 128,
  },
  review: null,
  return_request: null,
  actions: {
    can_review: false,
    reviewed: false,
    can_return: false,
    return_requested: false,
  },
};

const orderCardExample = {
  id: 41,
  display_id: 'KDF143625879',
  status: 'PENDING',
  status_label: 'Order Placed',
  status_tone: 'info',
  createdAt: '2026-07-09T12:45:00.000Z',
  total: 520,
  item_count: 2,
  seller: {
    id: 7,
    name: 'Roberts Junior',
    email: 'seller@example.com',
    avatar_url: 'https://cdn.bestkid.test/avatars/seller.png',
  },
  preview_items: [
    {
      id: 31,
      productId: 1,
      name: 'Kolev and Kolev - Soft Fit',
      image_url: 'https://cdn.bestkid.test/products/shoes-front.png',
      price: 260,
    },
  ],
  actions: {
    can_view_details: true,
    can_cancel: true,
  },
};

const orderDetailExample = {
  id: 41,
  display_id: 'KDF143625879',
  status: 'PENDING',
  status_label: 'Order Placed',
  status_tone: 'info',
  createdAt: '2026-07-09T12:45:00.000Z',
  updatedAt: '2026-07-09T12:45:00.000Z',
  total: 520,
  delivery: {
    partner: 'Speedy',
    cost: 4.99,
    days_min: 2,
    days_max: 4,
  },
  delivery_address: {
    address: '25 Ivan Vazov Street',
    city: 'Plovdiv',
    postal_code: '4000',
    country: 'Bulgaria',
  },
  buyer: {
    id: 22,
    name: 'Roberts Junior',
    email: 'buyer@example.com',
    avatar_url: 'https://cdn.bestkid.test/avatars/buyer.png',
  },
  seller: {
    id: 7,
    name: 'Roberts Junior',
    email: 'seller@example.com',
    avatar_url: 'https://cdn.bestkid.test/avatars/seller.png',
  },
  cancellation: null,
  timeline: {
    confirmed_at: null,
    processing_at: null,
    shipped_at: null,
    delivered_at: null,
    cancelled_at: null,
  },
  actions: {
    can_cancel: true,
  },
  items: [orderItemExample],
};

const checkoutSummaryExample = {
  selected_seller_ids: [7],
  selected_cart_item_ids: [31, 32],
  cart_item_count: 2,
  seller_groups: [
    {
      seller: {
        id: 7,
        email: 'seller@example.com',
        name: 'Roberts Junior',
        avatar_url: 'https://cdn.bestkid.test/avatars/seller.png',
        country: 'Bulgaria',
      },
      delivery: {
        type: 'domestic',
        partner: 'Bulgarian Post',
        cost: 4.99,
        days_min: 2,
        days_max: 4,
      },
      items: [
        {
          id: 31,
          productId: 1,
          price: 260,
          line_total: 260,
          product: {
            id: 1,
            name: 'Kolev and Kolev - Soft Fit',
            image_urls: ['https://cdn.bestkid.test/products/shoes-front.png'],
            image_url: 'https://cdn.bestkid.test/products/shoes-front.png',
            categoryId: 1,
            subCategoryId: 2,
          },
        },
        {
          id: 32,
          productId: 2,
          price: 260,
          line_total: 260,
          product: {
            id: 2,
            name: 'Kolev and Kolev - Soft Fit (Pair 2)',
            image_urls: ['https://cdn.bestkid.test/products/shoes-front.png'],
            image_url: 'https://cdn.bestkid.test/products/shoes-front.png',
            categoryId: 1,
            subCategoryId: 2,
          },
        },
      ],
      subtotal: 520,
      delivery_cost: 4.99,
      discount_amount: 104,
      total: 420.99,
    },
  ],
  addresses: [addressExample],
  selected_address: addressExample,
  coupon: {
    id: 6,
    code: 'KIDS20',
    discount_type: 'PERCENTAGE',
    discount_value: 20,
    discount_amount: 104,
    message: '20% discount applied to your order.',
  },
  price_details: {
    subtotal: 520,
    shipping_fee: 4.99,
    discount: 104,
    total: 420.99,
  },
  terms_required: true,
  payment: {
    provider: 'stripe',
    next_action: 'create_checkout_session',
  },
};

const buyNowCheckoutSummaryExample = {
  selected_seller_ids: [7],
  cart_item_count: 1,
  seller_groups: [
    {
      seller: checkoutSummaryExample.seller_groups[0].seller,
      delivery: checkoutSummaryExample.seller_groups[0].delivery,
      items: [
        {
          ...checkoutSummaryExample.seller_groups[0].items[0],
          id: null,
          line_total: 260,
        },
      ],
      subtotal: 260,
      delivery_cost: 4.99,
      discount_amount: 0,
      total: 264.99,
    },
  ],
  addresses: [addressExample],
  selected_address: {
    shippingAddress: '25 Ivan Vazov Street',
    city: 'Plovdiv',
    postalCode: '4000',
    country: 'Bulgaria',
  },
  requires_address_selection: false,
  coupon: null,
  price_details: {
    subtotal: 260,
    shipping_fee: 4.99,
    discount: 0,
    total: 264.99,
  },
  terms_required: true,
  payment: {
    provider: 'stripe',
    next_action: 'create_buy_now_checkout_session',
  },
};

const legitGrailsAuthenticationExample = {
  id: 5,
  productId: 1,
  provider: 'LEGITGRAILS',
  externalOrderId: '23423',
  status: 'queued',
  verdict: null,
  certificateUrl: null,
  reportUrl: null,
  image_urls: [
    'https://cdn.bestkid.test/verification/front.png',
    'https://cdn.bestkid.test/verification/back.png',
    'https://cdn.bestkid.test/verification/label.png',
  ],
  submittedAt: '2026-07-23T09:30:00.000Z',
  completedAt: null,
  lastError: null,
  createdAt: '2026-07-23T09:30:00.000Z',
  updatedAt: '2026-07-23T09:30:00.000Z',
};

const legitGrailsCategoriesExample = {
  data: [
    { code: 'bag', name: 'Bags', name_locale: 'Bags', icon_url: null },
    { code: 'sneaker', name: 'Sneakers', name_locale: 'Sneakers', icon_url: null },
  ],
};

const legitGrailsBrandsExample = {
  data: [
    { code: 'gucci', name: 'Gucci', name_locale: 'Gucci', categories: [{ code: 'bag', name: 'Bags', name_locale: 'Bags' }] },
    { code: 'nike', name: 'Nike', name_locale: 'Nike', categories: [{ code: 'sneaker', name: 'Sneakers', name_locale: 'Sneakers' }] },
  ],
  page: 1,
  limit: 10,
  total: 2,
};

const legitGrailsModelsExample = {
  data: [{ code: 'gucci-bag-gg-marmont', name: 'GG Marmont', name_locale: 'GG Marmont', image_url: null }],
  page: 1,
  limit: 10,
  total: 1,
};

const legitGrailsAnswerTimesExample = {
  data: [
    { code: 720, price: 5, default: true, available: true, next_available_at: null },
    { code: 1440, price: 3, default: false, available: true, next_available_at: null },
  ],
};

const legitGrailsPhotoIndexExample = {
  data: [
    {
      code: 'overall-picture',
      name: 'Overall picture',
      name_locale: 'Overall picture',
      required: true,
      photo_limit: 2,
      icon_url: null,
      example_urls: ['https://cdn.legitgrails.com/examples/overall-picture.png'],
    },
    {
      code: 'serial-number',
      name: 'Serial number',
      name_locale: 'Serial number',
      required: true,
      photo_limit: 1,
      icon_url: 'https://cdn.legitgrails.com/icons/serial-number.svg',
      example_urls: ['https://cdn.legitgrails.com/examples/serial-number.png'],
    },
  ],
};

const sellerOrderDetailExample = {
  ...orderDetailExample,
  chat_room_id: 11,
  ordered_by: orderDetailExample.buyer,
  actions: {
    can_update_status: true,
    can_message_buyer: true,
  },
  status_options: ['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'],
};

const sellerOrderCardExample = {
  ...orderCardExample,
  buyer: orderDetailExample.buyer,
  cancellation: null,
  timeline: sellerOrderDetailExample.timeline,
  actions: {
    can_view_details: true,
    can_update_status: true,
  },
};

const sellerProductOrderCardExample = {
  ...sellerOrderCardExample,
  matched_product_items: [
    {
      id: 31,
      productId: 1,
      name: 'Kolev and Kolev - Soft Fit',
      image_url: 'https://cdn.bestkid.test/products/shoes-front.png',
      price: 260,
      line_total: 260,
    },
  ],
  matched_item_count: 1,
};

const returnCardExample = {
  id: 12,
  order_id: 41,
  display_order_id: 'KDF143625879',
  status: 'PENDING',
  status_label: 'In Review',
  status_tone: 'warning',
  submitted_on: '2026-07-09T13:00:00.000Z',
  seller: orderDetailExample.seller,
  preview_item: {
    id: 31,
    productId: 1,
    name: 'Kolev and Kolev - Soft Fit',
    image_url: 'https://cdn.bestkid.test/products/shoes-front.png',
    price: 260,
  },
};

const sellerReturnCardExample = {
  ...returnCardExample,
  buyer: orderDetailExample.buyer,
  actions: {
    can_view_details: true,
    can_update_status: true,
  },
};

const returnDetailExample = {
  id: 12,
  status: 'PENDING',
  status_label: 'In Review',
  status_tone: 'warning',
  submitted_on: '2026-07-09T13:00:00.000Z',
  resolved_at: null,
  reason: 'Damage Product',
  message: 'The sole appears damaged.',
  images: ['https://cdn.bestkid.test/returns/evidence-1.png'],
  seller_response: null,
  seller_rejection_reason: null,
  return_address: null,
  completed_at: null,
  refunded_at: null,
  refund_amount: null,
  chat_room_id: 11,
  order: {
    ...orderDetailExample,
    status: 'DELIVERED',
    status_label: 'Delivered',
    status_tone: 'success',
    delivered_at: '2026-07-09T12:50:00.000Z',
  },
  returned_item: orderItemExample,
  actions: {
    can_message_seller: true,
    can_update_status: false,
    can_send_return_instructions: false,
    can_complete_refund: false,
    can_reject: false,
  },
};

const faqCategoryExample = {
  id: 2,
  name: 'Payments',
  createdAt: '2026-07-09T08:00:00.000Z',
  updatedAt: '2026-07-09T08:00:00.000Z',
};

const faqExample = {
  id: 7,
  categoryId: 2,
  question: 'How does the payment system work?',
  answer: 'Payments are processed securely through the platform checkout.',
  createdAt: '2026-07-09T08:10:00.000Z',
  updatedAt: '2026-07-09T08:10:00.000Z',
  category: faqCategoryExample,
};

const legalDocumentExample = {
  id: 3,
  type: 'TERMS',
  content:
    'By accessing or using this platform, you agree to the Terms & Conditions.',
  createdAt: '2026-07-09T08:00:00.000Z',
  updatedAt: '2026-07-09T08:00:00.000Z',
};

const aboutUsExample = {
  id: 1,
  content:
    "BestKid is a trusted marketplace for families to buy and sell children's products with confidence.",
  createdAt: '2026-07-09T08:00:00.000Z',
  updatedAt: '2026-07-09T08:00:00.000Z',
};

const companyInfoExample = {
  id: 1,
  about:
    "BestKid is a trusted marketplace for buying and selling children's products.",
  mission: 'Make kids fashion safer and easier for families.',
  vision: 'A trusted marketplace for every family.',
  values: 'Trust, quality, simplicity, and care.',
  createdAt: '2026-07-09T08:00:00.000Z',
  updatedAt: '2026-07-09T08:00:00.000Z',
};

const contactRequestExample = {
  id: 9,
  full_name: 'Roberts Junior',
  email: 'buyer@example.com',
  topic: 'Order support',
  message: 'I need help with my recent order.',
  reply: null,
  status: 'TO_DO',
  createdAt: '2026-07-09T08:20:00.000Z',
  updatedAt: '2026-07-09T08:20:00.000Z',
  status_label: 'To Do',
};

const sellerReadinessExample = {
  stripe_connected: true,
  stripe_account_id: 'acct_123456789',
  delivery_configured: true,
  can_create_product: true,
  can_publish_product: true,
  blockers: [],
  actions: {
    connect_stripe: false,
    setup_delivery: false,
  },
};

const sellerEarningsExample = {
  period: 'TODAY',
  earnings: 520,
  payment_history: [
    {
      order_id: 41,
      customer: {
        id: 22,
        name: 'Roberts Junior',
        avatar_url: 'https://cdn.bestkid.test/avatars/buyer.png',
      },
      paid_at: '2026-07-09T12:45:00.000Z',
      status: 'DELIVERED',
      amount: 520,
      item_count: 2,
    },
  ],
  meta: {
    total: 1,
    page: 1,
    limit: 10,
    pages: 1,
  },
};

const errorExamples: Record<
  number,
  { description: string; example: Record<string, unknown> }
> = {
  400: {
    description: 'Bad Request - validation or invalid input',
    example: {
      success: false,
      message: [
        'name should not be empty',
        'original_price must be a positive number',
      ],
      url: '/products',
      statusCode: 400,
    },
  },
  401: {
    description: 'Unauthorized - missing or invalid access token',
    example: {
      success: false,
      message: 'Unauthorized',
      url: '/orders',
      statusCode: 401,
    },
  },
  403: {
    description: 'Forbidden - authenticated user cannot perform this action',
    example: {
      success: false,
      message: 'You do not have permission to access this resource',
      url: '/products/1',
      statusCode: 403,
    },
  },
  404: {
    description: 'Not Found - requested resource does not exist',
    example: {
      success: false,
      message: 'Resource not found',
      url: '/products/999',
      statusCode: 404,
    },
  },
  409: {
    description: 'Conflict - request conflicts with existing data',
    example: {
      success: false,
      message: 'A resource with this value already exists',
      url: '/auth/register',
      statusCode: 409,
    },
  },
  500: {
    description: 'Internal Server Error',
    example: {
      success: false,
      message: 'Internal server error!',
      url: '/products',
      statusCode: 500,
    },
  },
};

export function applySwaggerResponseExamples(document: OpenAPIObject) {
  for (const [path, pathItem] of Object.entries(document.paths)) {
    if (path === '/') {
      continue;
    }

    for (const method of HTTP_METHODS) {
      const operation = pathItem?.[method];
      if (!operation) {
        continue;
      }

      operation.responses ??= {};
      applySuccessExample(operation, method, path);
      applyErrorExamples(operation, path);
    }
  }
}

function applySuccessExample(operation: any, method: string, path: string) {
  const hasPagination = (operation.parameters ?? []).some(
    (parameter: any) => parameter.name === 'page',
  );
  const routeExample = getRouteSuccessExample(method, path);
  const successStatus = routeExample
    ? String(routeExample.statusCode)
    : operation.responses['201']
      ? '201'
      : operation.responses['200']
        ? '200'
        : method === 'post'
          ? '201'
          : '200';
  const response = operation.responses[successStatus] ?? {
    description: successStatus === '201' ? 'Created' : 'Successful response',
  };
  const example =
    routeExample ?? getSuccessExample(successStatus, hasPagination);

  operation.responses[successStatus] = withJsonExample(response, {
    schema: successEnvelopeSchema,
    examples: {
      [hasPagination
        ? 'paginated_success'
        : successStatus === '201'
          ? 'created_success'
          : 'success']: {
        summary: response.description ?? 'Successful response',
        value: {
          ...example,
          statusCode: Number(successStatus),
        },
      },
    },
  });
}

function getSuccessExample(successStatus: string, hasPagination: boolean) {
  return successStatus === '201'
    ? createdExample
    : hasPagination
      ? paginatedExample
      : successExample;
}

function getRouteSuccessExample(method: string, path: string) {
  const key = `${method.toUpperCase()} ${path}`;

  const routeExamples: Record<string, Record<string, unknown>> = {
    'GET /account/settings': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: {
        ...userExample,
        addresses: [addressExample],
        connected_account: connectedAccountExample,
      },
    },
    'GET /account/header-summary': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: {
        user: {
          id: 22,
          email: 'buyer@example.com',
          role: 'USER',
          profile: {
            full_name: 'Roberts Junior',
            avatar_url: 'https://cdn.bestkid.test/avatars/buyer.png',
          },
        },
        counts: {
          wishlist: 4,
          cart: 2,
          notifications: 1,
        },
      },
    },
    'GET /account/buying-summary': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: {
        orders: {
          active: 1,
          complete: 2,
          canceled: 0,
        },
        returns: {
          return_requests: 1,
          accepted: 0,
          rejected: 0,
        },
      },
    },
    'GET /account/addresses': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: [addressExample],
    },
    'POST /account/addresses': {
      success: true,
      statusCode: 201,
      message: 'Request successful',
      data: addressExample,
    },
    'PATCH /account/addresses/{id}': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: addressExample,
    },
    'DELETE /account/addresses/{id}': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: { message: 'Address deleted successfully' },
    },
    'PATCH /account/preferences/language': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: {
        id: 22,
        language_preference: 'EN',
        currency_preference: 'EUR',
      },
    },
    'PATCH /account/preferences/currency': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: {
        id: 22,
        language_preference: 'EN',
        currency_preference: 'EUR',
      },
    },
    'GET /account/connected-account': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: connectedAccountExample,
    },
    'DELETE /account': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: { message: 'Account deleted successfully' },
    },
    'POST /auth/register': {
      success: true,
      statusCode: 201,
      message: 'Request successful',
      data: {
        user: {
          ...userExample,
          password: '$2b$10$hashedPasswordExample',
        },
        email_verification_id: 'otp_req_123',
      },
    },
    'POST /auth/login': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example',
    },
    'POST /auth/admin/login': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: {
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.admin',
        user: {
          id: 1,
          email: 'admin@example.com',
          role: 'ADMIN',
          profile: {
            id: 1,
            avatar_url: null,
            full_name: 'BestKid Admin',
            phone: '+359 88 123 4567',
            country: 'Bulgaria',
            userId: 1,
            createdAt: '2026-07-09T09:00:00.000Z',
            updatedAt: '2026-07-09T09:00:00.000Z',
          },
        },
      },
    },
    'POST /auth/verify-email': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: {
        id: 3,
        requestId: 'otp_req_123',
        userId: 22,
        purpose: 'EMAIL_VERIFICATION',
        attempts: 0,
        maxAttempts: 5,
        verified: true,
        used: true,
        expiresAt: '2026-07-09T10:15:00.000Z',
        createdAt: '2026-07-09T10:00:00.000Z',
      },
    },
    'POST /auth/resend-otp': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: { email_verification_id: 'otp_req_456' },
    },
    'POST /auth/forgot-password': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: {
        message: 'If that email is registered, an OTP has been sent.',
        requestId: 'reset_req_123',
      },
    },
    'POST /auth/admin/forgot-password': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: {
        message:
          'If that admin email is registered, a verification code has been sent.',
        requestId: 'reset_req_123',
      },
    },
    'POST /auth/forgot-password/resend': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: {
        message: 'If that email is registered, an OTP has been sent.',
        requestId: 'reset_req_456',
      },
    },
    'POST /auth/admin/forgot-password/resend': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: {
        message:
          'If that admin email is registered, a verification code has been sent.',
        requestId: 'reset_req_456',
      },
    },
    'POST /auth/verify-reset-otp': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: {
        message: 'OTP verified. You may now reset your password.',
        requestId: 'reset_req_123',
      },
    },
    'POST /auth/admin/verify-reset-otp': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: {
        message: 'OTP verified. You may now reset your admin password.',
        requestId: 'reset_req_123',
      },
    },
    'POST /auth/reset-password': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: { message: 'Password has been reset successfully.' },
    },
    'POST /auth/admin/reset-password': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: { message: 'Admin password has been reset successfully.' },
    },
    'GET /auth/me': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: userExample,
    },
    'GET /cart': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: cartExample,
    },
    'POST /cart/items': {
      success: true,
      statusCode: 201,
      message: 'Request successful',
      data: cartItemExample,
    },
    'DELETE /cart/items/{itemId}': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: { message: 'Item removed from cart' },
    },
    'DELETE /cart': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: { message: 'Cart cleared' },
    },
    'POST /categories': {
      success: true,
      statusCode: 201,
      message: 'Request successful',
      data: categoryExample,
    },
    'GET /categories': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: [
        {
          ...categoryExample,
          product_count: 26,
          subCategories: [{ ...subCategoryExample, product_count: 8 }],
        },
      ],
      meta: {
        total: 6,
        page: 1,
        limit: 10,
        pages: 1,
      },
    },
    'GET /categories/{id}': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: {
        ...categoryExample,
        product_count: 26,
        subCategories: [{ ...subCategoryExample, product_count: 8 }],
      },
    },
    'PATCH /categories/{id}': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: categoryExample,
    },
    'DELETE /categories/{id}': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: categoryExample,
    },
    'POST /categories/{id}/subcategories': {
      success: true,
      statusCode: 201,
      message: 'Request successful',
      data: subCategoryExample,
    },
    'PATCH /categories/{catId}/subcategories/{subId}': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: subCategoryExample,
    },
    'DELETE /categories/{catId}/subcategories/{subId}': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: subCategoryExample,
    },
    'POST /chat/rooms': {
      success: true,
      statusCode: 201,
      message: 'Request successful',
      data: chatRoomExample,
    },
    'GET /chat/rooms': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: [chatRoomExample],
      meta: {
        total: 1,
        page: 1,
        limit: 10,
        pages: 1,
      },
    },
    'GET /chat/rooms/{id}/messages': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: {
        room: chatRoomExample,
        data: [chatMessageExample],
        meta: {
          total: 1,
          page: 1,
          limit: 20,
          pages: 1,
        },
      },
    },
    'PATCH /chat/rooms/{id}/read': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: { message: 'Messages marked as read' },
    },
    'PATCH /chat/rooms/{id}/block': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: {
        ...chatRoomExample,
        is_blocked: true,
        blocked_by_me: true,
        messaging_available: false,
        unavailable_reason: 'BLOCKED_BY_ME',
      },
    },
    'PATCH /chat/rooms/{id}/unblock': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: chatRoomExample,
    },
    'DELETE /chat/rooms/{id}': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: { message: 'Conversation deleted from your messages' },
    },
    'GET /home': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: {
        categories: [
          {
            ...categoryExample,
            product_count: 26,
            subCategories: [{ id: 2, name: 'Kids Sneakers' }],
          },
        ],
        trending: [publicProductExample],
        promoted: [publicProductExample],
        new_arrivals: [publicProductExample],
        trust_cards: [
          { key: 'secure_payments', title: 'Secure Payments', tone: 'success' },
          { key: 'easy_returns', title: 'Easy Returns', tone: 'info' },
          { key: 'trusted_sellers', title: 'Trusted Sellers', tone: 'warning' },
          {
            key: 'europe_access',
            title: 'Europe-wide Access',
            tone: 'neutral',
          },
        ],
      },
    },
    'GET /home/trending': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: [
        {
          ...homeProductCardExample,
          views: 128,
        },
      ],
      meta: {
        total: 24,
        page: 1,
        limit: 20,
        pages: 2,
      },
    },
    'GET /home/new-arrivals': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: [homeProductCardExample],
      meta: {
        total: 24,
        page: 1,
        limit: 20,
        pages: 2,
      },
    },
    'GET /home/recently-viewed': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: [
        {
          id: 1,
          name: 'Kids Cotton Hoodie - Soft Fit',
          original_price: 21.99,
          discounted_price: 18,
          discount_percentage: 18,
          image_urls: ['https://cdn.bestkid.test/products/hoodie-front.png'],
          average_rating: 4.9,
          status: 'ACTIVE',
          category: { id: 1, name: 'Kids' },
          viewed_at: '2026-07-09T12:00:00.000Z',
        },
      ],
      meta: {
        total: 1,
        page: 1,
        limit: 10,
        pages: 1,
      },
    },
    'PUT /delivery/me': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: deliveryOptionExample,
    },
    'PUT /delivery/me/domestic': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: deliveryOptionExample,
    },
    'PUT /delivery/me/international': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: deliveryOptionExample,
    },
    'GET /delivery/me': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: { data: deliveryOptionExample },
    },
    'GET /delivery/{sellerId}': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: { data: deliveryOptionExample },
    },
    'GET /notifications': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: [notificationExample],
      meta: {
        total: 1,
        page: 1,
        limit: 10,
        pages: 1,
      },
    },
    'GET /notifications/unread-count': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: { count: 1 },
    },
    'PATCH /notifications/read-all': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: { message: 'All notifications marked as read' },
    },
    'PATCH /notifications/{id}/read': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: { ...notificationExample, isRead: true },
    },
    'DELETE /notifications/{id}': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: { message: 'Notification deleted' },
    },
    'POST /orders': {
      success: true,
      statusCode: 201,
      message: 'Request successful',
      data: orderDetailExample,
    },
    'POST /orders/checkout': {
      success: true,
      statusCode: 201,
      message: 'Request successful',
      data: { orders: [orderDetailExample] },
    },
    'GET /orders/checkout/summary': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: checkoutSummaryExample,
    },
    'POST /orders/checkout/buy-now-summary': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: buyNowCheckoutSummaryExample,
    },
    'POST /orders/checkout/apply-coupon': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: {
        valid: true,
        message: '20% discount applied to your order.',
        coupon: checkoutSummaryExample.coupon,
        price_details: checkoutSummaryExample.price_details,
      },
    },
    'GET /orders': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: [orderCardExample],
      meta: {
        total: 1,
        page: 1,
        limit: 10,
        pages: 1,
      },
    },
    'GET /orders/seller/all': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: [sellerOrderCardExample],
      meta: {
        total: 1,
        page: 1,
        limit: 10,
        pages: 1,
      },
    },
    'GET /orders/seller/products/{productId}/orders': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: [sellerProductOrderCardExample],
      meta: {
        total: 1,
        page: 1,
        limit: 10,
        pages: 1,
      },
    },
    'GET /orders/seller/{id}': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: sellerOrderDetailExample,
    },
    'POST /orders/{id}/chat': {
      success: true,
      statusCode: 201,
      message: 'Request successful',
      data: chatRoomExample,
    },
    'GET /orders/admin/all': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: [sellerOrderCardExample],
      meta: {
        total: 1,
        page: 1,
        limit: 10,
        pages: 1,
      },
    },
    'GET /orders/{id}': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: orderDetailExample,
    },
    'PATCH /orders/{id}/cancel': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: {
        ...orderDetailExample,
        status: 'CANCELLED',
        status_label: 'Canceled',
        status_tone: 'danger',
        cancellation: {
          cancelled_at: '2026-07-09T13:15:00.000Z',
          cancelled_by_user_id: 22,
          cancelled_by_actor: 'BUYER',
          cancellation_reason: 'Ordered by mistake',
        },
      },
    },
    'POST /orders/items/{orderItemId}/review': {
      success: true,
      statusCode: 201,
      message: 'Request successful',
      data: productReviewExample,
    },
    'PATCH /orders/seller/{id}/status': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: {
        ...sellerOrderDetailExample,
        status: 'SHIPPED',
        status_label: 'Shipped',
        status_tone: 'warning',
      },
    },
    'PATCH /orders/admin/{id}/status': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: {
        ...sellerOrderDetailExample,
        status: 'CONFIRMED',
        status_label: 'Confirmed',
        status_tone: 'info',
      },
    },
    'POST /products': {
      success: true,
      statusCode: 201,
      message: 'Request successful',
      data: productWithRelationsExample,
    },
    'GET /products': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: [publicProductExample],
      meta: {
        total: 24,
        page: 1,
        limit: 10,
        pages: 3,
      },
    },
    'GET /products/admin/all': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: [
        {
          ...productBaseExample,
          category: categoryExample,
          subCategory: subCategoryExample,
          user: {
            id: 7,
            email: 'seller@example.com',
            profile: { full_name: 'Roberts Junior' },
          },
        },
      ],
      meta: {
        total: 24,
        page: 1,
        limit: 10,
        pages: 3,
      },
    },
    'GET /legitgrails/brands': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: legitGrailsBrandsExample,
    },
    'GET /legitgrails/categories': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: legitGrailsCategoriesExample,
    },
    'GET /legitgrails/models': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: legitGrailsModelsExample,
    },
    'GET /legitgrails/answer-times': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: legitGrailsAnswerTimesExample,
    },
    'GET /legitgrails/photo-index': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: legitGrailsPhotoIndexExample,
    },
    'POST /products/{id}/authentication/submit': {
      success: true,
      statusCode: 201,
      message: 'Request successful',
      data: legitGrailsAuthenticationExample,
    },
    'POST /products/{id}/authentication/reupload-photos': {
      success: true,
      statusCode: 201,
      message: 'Request successful',
      data: { ...legitGrailsAuthenticationExample, status: 'accepted' },
    },
    'GET /products/{id}/authentication': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: {
        product: {
          id: 1,
          userId: 7,
          brand: 'Zara Kids',
          status: 'INACTIVE',
          is_authenticated: false,
          authentication_status: 'PENDING',
          approved_at: null,
          rejected_at: null,
        },
        latest_request: legitGrailsAuthenticationExample,
        requests: [legitGrailsAuthenticationExample],
      },
    },
    'GET /products/seller/my': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: [sellerProductCardExample],
      meta: {
        total: 4,
        page: 1,
        limit: 10,
        pages: 1,
      },
    },
    'GET /products/seller/{id}': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: sellerProductDetailExample,
    },
    'PATCH /products/seller/{id}/status': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: sellerProductDetailExample,
    },
    'PATCH /products/admin/{id}/auth-status': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: {
        ...productBaseExample,
        authentication_status: 'VERIFIED',
        is_authenticated: true,
        approved_at: '2026-07-09T12:00:00.000Z',
        category: categoryExample,
        subCategory: subCategoryExample,
        user: {
          id: 7,
          email: 'seller@example.com',
          profile: { full_name: 'Roberts Junior' },
        },
      },
    },
    'GET /products/{id}': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: publicProductDetailExample,
    },
    'PATCH /products/{id}': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: {
        ...productWithRelationsExample,
        user: sellerProductDetailExample.seller,
      },
    },
    'DELETE /products/{id}': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: productBaseExample,
    },
    'POST /products/{id}/reviews': {
      success: true,
      statusCode: 201,
      message: 'Request successful',
      data: productReviewExample,
    },
    'GET /products/{id}/reviews': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: [
        {
          ...productReviewExample,
          user: {
            id: 22,
            profile: {
              full_name: 'Maximilian Becker',
              avatar_url: 'https://cdn.bestkid.test/avatars/buyer.png',
            },
          },
        },
      ],
      meta: {
        total: 5,
        page: 1,
        limit: 10,
        pages: 1,
      },
    },
    'GET /profile': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: {
        ...userExample,
        selling_tier: 'Basic Seller',
        email_update_restricted: true,
        email_update_restricted_reason:
          'Email updates are restricted because the email address is linked to authentication, security verification, and order records.',
      },
    },
    'PATCH /profile': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: {
        ...userExample,
        selling_tier: 'Basic Seller',
        email_update_restricted: true,
        email_update_restricted_reason:
          'Email updates are restricted because the email address is linked to authentication, security verification, and order records.',
      },
    },
    'PATCH /profile/update-password': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: {
        ...userExample,
        selling_tier: 'Basic Seller',
        email_update_restricted: true,
        email_update_restricted_reason:
          'Email updates are restricted because the email address is linked to authentication, security verification, and order records.',
      },
    },
    'POST /returns': {
      success: true,
      statusCode: 201,
      message: 'Request successful',
      data: returnDetailExample,
    },
    'GET /returns': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: [returnCardExample],
      meta: {
        total: 1,
        page: 1,
        limit: 10,
        pages: 1,
      },
    },
    'GET /returns/seller/all': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: [sellerReturnCardExample],
      meta: {
        total: 1,
        page: 1,
        limit: 10,
        pages: 1,
      },
    },
    'GET /returns/admin/all': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: [sellerReturnCardExample],
      meta: {
        total: 1,
        page: 1,
        limit: 10,
        pages: 1,
      },
    },
    'POST /returns/{id}/chat': {
      success: true,
      statusCode: 201,
      message: 'Request successful',
      data: chatRoomExample,
    },
    'GET /returns/{id}': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: returnDetailExample,
    },
    'PATCH /returns/seller/{id}/status': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: {
        ...returnDetailExample,
        status: 'PROCESSING',
        status_label: 'Processing',
        status_tone: 'info',
        return_address: 'BestKid Returns Warehouse, Plovdiv 4000, Bulgaria',
        actions: {
          can_message_seller: true,
          can_update_status: true,
          can_send_return_instructions: false,
          can_complete_refund: true,
          can_reject: true,
        },
      },
    },
    'PATCH /returns/admin/{id}/status': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: {
        ...returnDetailExample,
        status: 'COMPLETED',
        status_label: 'Completed',
        status_tone: 'success',
        completed_at: '2026-07-09T14:00:00.000Z',
        refunded_at: '2026-07-09T14:00:00.000Z',
        refund_amount: 260,
      },
    },
    'GET /seller/options': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: {
        options: [
          { key: 'customer_orders', label: 'Customer Orders', count: 2 },
          { key: 'return_orders', label: 'Return Orders', count: 1 },
          { key: 'earnings', label: 'Earnings', amount: 520 },
          {
            key: 'delivery_options',
            label: 'Delivery Options',
            configured: true,
          },
        ],
      },
    },
    'GET /seller/readiness': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: sellerReadinessExample,
    },
    'GET /seller/earnings': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: sellerEarningsExample,
    },
    'POST /uploads': {
      success: true,
      statusCode: 201,
      message: 'Request successful',
      data: { filePath: '/uploads/product-1720520130000.png' },
    },
    'DELETE /uploads': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: { message: 'File deleted successfully.' },
    },
    'GET /wishlist': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: [
        {
          id: 17,
          userId: 22,
          productId: 1,
          createdAt: '2026-07-09T11:00:00.000Z',
          product: publicProductExample,
          is_wishlisted: true,
        },
      ],
      meta: {
        total: 1,
        page: 1,
        limit: 10,
        pages: 1,
      },
    },
    'GET /wishlist/count': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: { count: 4 },
    },
    'POST /wishlist/{productId}': {
      success: true,
      statusCode: 201,
      message: 'Request successful',
      data: {
        id: 17,
        userId: 22,
        productId: 1,
        createdAt: '2026-07-09T11:00:00.000Z',
        is_wishlisted: true,
      },
    },
    'DELETE /wishlist/{productId}': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: {
        message: 'Product removed from wishlist',
        is_wishlisted: false,
      },
    },
    'GET /content/faq/categories': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: [faqCategoryExample],
      meta: {
        total: 1,
        page: 1,
        limit: 10,
        pages: 1,
      },
    },
    'POST /content/faq/categories': {
      success: true,
      statusCode: 201,
      message: 'Request successful',
      data: faqCategoryExample,
    },
    'GET /content/faq': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: [faqExample],
      meta: {
        total: 1,
        page: 1,
        limit: 10,
        pages: 1,
      },
    },
    'POST /content/faq': {
      success: true,
      statusCode: 201,
      message: 'Request successful',
      data: faqExample,
    },
    'PATCH /content/faq/{id}': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: faqExample,
    },
    'DELETE /content/faq/{id}': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: { message: 'FAQ deleted successfully' },
    },
    'GET /content/legal/{type}': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: legalDocumentExample,
    },
    'PATCH /content/legal/{type}': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: legalDocumentExample,
    },
    'GET /content/company': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: companyInfoExample,
    },
    'PATCH /content/company': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: companyInfoExample,
    },
    'GET /content/about-us': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: aboutUsExample,
    },
    'POST /content/about-us': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: aboutUsExample,
    },
    'POST /content/contact': {
      success: true,
      statusCode: 201,
      message: 'Request successful',
      data: contactRequestExample,
    },
    'GET /content/contact/admin': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: [contactRequestExample],
      meta: {
        total: 1,
        page: 1,
        limit: 10,
        pages: 1,
      },
    },
    'GET /content/contact/admin/{id}': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: contactRequestExample,
    },
    'PATCH /content/contact/admin/{id}/reply': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: {
        ...contactRequestExample,
        reply: 'Thanks for reaching out. We will help you shortly.',
        status: 'RESOLVED',
        status_label: 'Resolved',
      },
    },
    'PATCH /content/contact/admin/{id}/resolve': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: {
        ...contactRequestExample,
        status: 'RESOLVED',
        status_label: 'Resolved',
      },
    },
    'GET /admin/coupons': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: [couponExample],
      meta: {
        total: 1,
        page: 1,
        limit: 10,
        pages: 1,
      },
    },
    'GET /admin/coupons/{id}': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: couponExample,
    },
    'POST /admin/coupons': {
      success: true,
      statusCode: 201,
      message: 'Request successful',
      data: couponExample,
    },
    'PATCH /admin/coupons/{id}': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: couponExample,
    },
    'DELETE /admin/coupons/{id}': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: { message: 'Coupon deleted successfully' },
    },
    'GET /admin/dashboard': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: {
        cards: {
          totalUsers: 120,
          totalEarnings: 5200,
          totalSupport: 8,
        },
        activity: {
          period: 'TODAY',
          rows: [
            {
              key: 'NEW_USERS_JOINED',
              label: 'New Users Joined',
              value: 4,
              previousValue: 2,
              percentage: 100,
              direction: 'HIGHER',
            },
          ],
        },
        recentlyJoinedUsers: [
          {
            id: 22,
            email: 'buyer@example.com',
            is_blocked: false,
            seller_tier: 'BASIC_SELLER',
            createdAt: '2026-07-09T09:00:00.000Z',
            profile: {
              full_name: 'Roberts Junior',
              phone: '+359 77 123 4567',
              avatar_url: 'https://cdn.bestkid.test/avatars/buyer.png',
            },
          },
        ],
      },
    },
    'GET /admin/dashboard/activity': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: {
        period: 'TODAY',
        rows: [
          {
            key: 'NEW_USERS_JOINED',
            label: 'New Users Joined',
            value: 4,
            previousValue: 2,
            percentage: 100,
            direction: 'HIGHER',
          },
          {
            key: 'TOTAL_EARNINGS',
            label: 'Total Earnings',
            value: 520,
            previousValue: 260,
            percentage: 100,
            direction: 'HIGHER',
          },
        ],
      },
    },
    'GET /admin/earnings': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: {
        period: 'TODAY',
        matrix: {
          earnings: 5200,
          previousEarnings: 2600,
          percentage: 100,
          direction: 'HIGHER',
        },
        transactions: [
          {
            sl: 1,
            pay_on: '2026-07-09T12:45:00.000Z',
            txn_id: 'TXN00000041',
            amount: 520,
            order_id: 41,
            seller: {
              id: 7,
              email: 'seller@example.com',
              profile: { full_name: 'Roberts Junior' },
            },
            buyer: {
              id: 22,
              email: 'buyer@example.com',
              profile: { full_name: 'Roberts Junior' },
            },
          },
        ],
        meta: {
          total: 1,
          page: 1,
          limit: 10,
          pages: 1,
        },
      },
    },
    'GET /users': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: [userExample],
      meta: {
        total: 1,
        page: 1,
        limit: 10,
        pages: 1,
      },
    },
    'GET /users/admin/all': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: [userExample],
      meta: {
        total: 1,
        page: 1,
        limit: 10,
        pages: 1,
      },
    },
    'GET /users/admin/{id}': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: {
        ...userExample,
        statistics: {
          buying: {
            totalOrders: 3,
            activeOrders: 1,
            totalReturns: 1,
            totalCanceled: 0,
          },
          selling: {
            totalOrders: 2,
            totalEarnings: 520,
            totalReturns: 1,
            totalCanceled: 0,
            listedProducts: 4,
          },
        },
      },
    },
    'GET /users/admin/{id}/products': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: [productWithRelationsExample],
      meta: {
        total: 4,
        page: 1,
        limit: 10,
        pages: 1,
      },
    },
    'PATCH /users/admin/{id}/block': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: { ...userExample, is_blocked: true },
    },
    'PATCH /users/admin/{id}/role': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: { ...userExample, role: 'ADMIN' },
    },
    'PATCH /users/admin/{id}/seller-tier': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: { ...userExample, seller_tier: 'STANDARD_SELLER' },
    },
    'PATCH /users/{id}/block': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: { ...userExample, is_blocked: true },
    },
    'PATCH /users/{id}/unblock': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: { ...userExample, is_blocked: false },
    },
    'DELETE /users/{id}': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: userExample,
    },
    'POST /stripe/onboard': {
      success: true,
      statusCode: 201,
      message: 'Request successful',
      data: {
        url: 'https://connect.stripe.com/setup/s/acct_123456789',
        stripe_account_id: 'acct_123456789',
      },
    },
    'POST /stripe/checkout-session': {
      success: true,
      statusCode: 201,
      message: 'Request successful',
      data: {
        session_id: 'cs_test_123456789',
        url: 'https://checkout.stripe.com/c/pay/cs_test_123456789',
        currency: 'eur',
        amount_total: 420.99,
        checkout_summary: checkoutSummaryExample,
      },
    },
    'POST /stripe/buy-now-session': {
      success: true,
      statusCode: 201,
      message: 'Request successful',
      data: {
        session_id: 'cs_test_buy_now_123456789',
        url: 'https://checkout.stripe.com/c/pay/cs_test_buy_now_123456789',
        currency: 'eur',
        amount_total: 264.99,
        checkout_summary: {
          ...buyNowCheckoutSummaryExample,
          seller_groups: [
            {
              ...buyNowCheckoutSummaryExample.seller_groups[0],
              delivery: checkoutSummaryExample.seller_groups[0].delivery,
              delivery_cost: 4.99,
              total: 264.99,
            },
          ],
          selected_address: {
            shippingAddress: '25 Ivan Vazov Street',
            city: 'Plovdiv',
            postalCode: '4000',
            country: 'Bulgaria',
          },
          requires_address_selection: false,
          price_details: {
            subtotal: 260,
            shipping_fee: 4.99,
            discount: 0,
            total: 264.99,
          },
          payment: {
            provider: 'stripe',
            next_action: 'create_buy_now_checkout_session',
          },
        },
      },
    },
    'GET /stripe/status': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: {
        stripe_account_id: 'acct_123456789',
        stripe_onboarding_complete: true,
      },
    },
    'GET /stripe/callback': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: {
        stripe_onboarding_complete: true,
        stripe_account_id: 'acct_123456789',
        message: 'Stripe onboarding complete!',
      },
    },
    'POST /stripe/webhook': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: { received: true },
    },
    'POST /legitgrails/webhook': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: {
        received: true,
        authentication: {
          ...legitGrailsAuthenticationExample,
          status: 'completed',
          verdict: 'authentic',
          completedAt: '2026-07-23T10:00:00.000Z',
          certificateUrl: 'https://legitgrails.example/certificates/lg_auth_123456789.pdf',
        },
      },
    },
    'GET /stripe/admin/accounts': {
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: [
        {
          id: 7,
          email: 'seller@example.com',
          seller_tier: 'BASIC_SELLER',
          stripe_account_id: 'acct_123456789',
          stripe_onboarding_complete: true,
          profile: {
            full_name: 'Roberts Junior',
          },
        },
      ],
      meta: {
        total: 1,
        page: 1,
        limit: 20,
        pages: 1,
      },
    },
  };

  return routeExamples[key];
}

function applyErrorExamples(operation: any, path: string) {
  const url = exampleUrlFromOpenApiPath(path);

  for (const [statusCode, config] of Object.entries(errorExamples)) {
    const response = operation.responses[statusCode] ?? {
      description: config.description,
    };
    operation.responses[statusCode] = withJsonExample(response, {
      schema: errorEnvelopeSchema,
      examples: {
        [`error_${statusCode}`]: {
          summary: config.description,
          value: {
            ...config.example,
            url,
          },
        },
      },
    });
  }
}

function withJsonExample(response: any, content: Record<string, unknown>) {
  return {
    ...response,
    content: {
      ...(response.content ?? {}),
      'application/json': {
        ...(response.content?.['application/json'] ?? {}),
        ...content,
      },
    },
  };
}

function exampleUrlFromOpenApiPath(path: string) {
  return path.replace(/\{[^}]+\}/g, '1');
}
