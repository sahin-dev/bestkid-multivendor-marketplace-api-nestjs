import { applySwaggerResponseExamples } from './response-examples';

describe('applySwaggerResponseExamples', () => {
  it('adds success and error examples that match the API response envelope', () => {
    const document: any = {
      paths: {
        '/products/{id}': {
          get: {
            parameters: [{ name: 'id', in: 'path' }],
            responses: {},
          },
        },
        '/products': {
          get: {
            parameters: [{ name: 'page', in: 'query' }],
            responses: {},
          },
        },
        '/auth/login': {
          post: {
            responses: {},
          },
        },
        '/cart': {
          get: {
            responses: {},
          },
        },
        '/orders/{id}': {
          get: {
            responses: {},
          },
        },
        '/orders/checkout/summary': {
          get: {
            responses: {},
          },
        },
        '/orders/checkout/buy-now-summary': {
          post: {
            responses: {
              '200': { description: 'Buy Now checkout summary for review before payment' },
            },
          },
        },
        '/orders/seller/products/{productId}/orders': {
          get: {
            parameters: [{ name: 'page', in: 'query' }],
            responses: {},
          },
        },
        '/returns/{id}': {
          get: {
            responses: {},
          },
        },
        '/delivery/me': {
          get: {
            responses: {},
          },
        },
        '/chat/rooms/{id}/messages': {
          get: {
            parameters: [{ name: 'page', in: 'query' }],
            responses: {},
          },
        },
        '/home/trending': {
          get: {
            parameters: [{ name: 'page', in: 'query' }],
            responses: {},
          },
        },
        '/home/new-arrivals': {
          get: {
            parameters: [{ name: 'page', in: 'query' }],
            responses: {},
          },
        },
        '/home/recently-viewed': {
          get: {
            parameters: [{ name: 'page', in: 'query' }],
            responses: {},
          },
        },
        '/stripe/buy-now-session': {
          post: {
            responses: {},
          },
        },
      },
    };

    applySwaggerResponseExamples(document);

    const detailSuccess =
      document.paths['/products/{id}'].get.responses['200'].content[
        'application/json'
      ].examples.success.value;
    expect(detailSuccess.success).toBe(true);
    expect(detailSuccess.statusCode).toBe(200);
    expect(detailSuccess.message).toBe('Request successful');
    expect(detailSuccess.data).toMatchObject({
      id: 1,
      name: 'Kids Cotton Hoodie - Soft Fit',
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
      category: { id: 1, name: 'Kids' },
      subCategory: { id: 2, name: 'Kids Sneakers', categoryId: 1 },
      effective_price: 18,
      is_wishlisted: false,
      seller_overview: {
        active_products: 4,
        items_sold: 16,
        average_rating: 4.9,
        total_reviews: 128,
      },
    });

    const notFound =
      document.paths['/products/{id}'].get.responses['404'].content[
        'application/json'
      ].examples.error_404.value;
    expect(notFound).toEqual({
      success: false,
      message: 'Resource not found',
      url: '/products/1',
      statusCode: 404,
    });

    const paginated =
      document.paths['/products'].get.responses['200'].content[
        'application/json'
      ].examples.paginated_success.value;
    expect(paginated).toMatchObject({
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: [
        {
          id: 1,
          name: 'Kids Cotton Hoodie - Soft Fit',
          original_price: 21.99,
          discounted_price: 18,
          category: { id: 1, name: 'Kids' },
          subCategory: { id: 2, name: 'Kids Sneakers' },
          effective_price: 18,
          is_wishlisted: false,
        },
      ],
      meta: {
        total: 24,
        page: 1,
        limit: 10,
        pages: 3,
      },
    });

    const loginSuccess =
      document.paths['/auth/login'].post.responses['200'].content[
        'application/json'
      ].examples.success.value;
    expect(loginSuccess).toMatchObject({
      success: true,
      statusCode: 200,
      message: 'Request successful',
    });
    expect(typeof loginSuccess.data).toBe('string');
    expect(document.paths['/auth/login'].post.responses['201']).toBeUndefined();

    const cartSuccess =
      document.paths['/cart'].get.responses['200'].content['application/json']
        .examples.success.value;
    expect(cartSuccess.data).toMatchObject({
      seller_groups: [
        {
          seller: { id: 7, name: 'Roberts Junior', country: 'Bulgaria' },
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
    });

    const orderSuccess =
      document.paths['/orders/{id}'].get.responses['200'].content[
        'application/json'
      ].examples.success.value;
    expect(orderSuccess.data).toMatchObject({
      id: 41,
      display_id: 'KDF143625879',
      status: 'PENDING',
      delivery_address: {
        address: '25 Ivan Vazov Street',
        city: 'Plovdiv',
        postal_code: '4000',
        country: 'Bulgaria',
      },
      buyer: { id: 22, email: 'buyer@example.com' },
      seller: { id: 7, email: 'seller@example.com' },
      items: [
        {
          id: 31,
          productId: 1,
          line_total: 260,
          actions: {
            can_review: false,
            reviewed: false,
            can_return: false,
            return_requested: false,
          },
        },
      ],
    });

    const checkoutSummarySuccess =
      document.paths['/orders/checkout/summary'].get.responses['200'].content[
        'application/json'
      ].examples.success.value;
    expect(checkoutSummarySuccess.data).toMatchObject({
      selected_seller_ids: [7],
      selected_cart_item_ids: [31, 32],
      seller_groups: [
        {
          items: [
            {
              id: 31,
              productId: 1,
              price: 260,
            },
            {
              id: 32,
              productId: 2,
              price: 260,
            },
          ],
        },
      ],
      price_details: {
        subtotal: 520,
        shipping_fee: 4.99,
        discount: 104,
        total: 420.99,
      },
    });

    const buyNowSummarySuccess =
      document.paths['/orders/checkout/buy-now-summary'].post.responses['200']
        .content['application/json'].examples.success.value;
    expect(buyNowSummarySuccess.data).toMatchObject({
      selected_seller_ids: [7],
      cart_item_count: 1,
      seller_groups: [
        {
          delivery: {
            cost: 4.99,
          },
          items: [
            {
              id: null,
              productId: 1,
            },
          ],
          delivery_cost: 4.99,
          discount_amount: 0,
          total: 264.99,
        },
      ],
      selected_address: expect.objectContaining({
        shippingAddress: '25 Ivan Vazov Street',
        city: 'Plovdiv',
        country: 'Bulgaria',
      }),
      requires_address_selection: false,
      coupon: null,
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
    });

    const sellerProductOrdersSuccess =
      document.paths['/orders/seller/products/{productId}/orders'].get
        .responses['200'].content['application/json'].examples
        .paginated_success.value;
    expect(sellerProductOrdersSuccess).toMatchObject({
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: [
        {
          id: 41,
          display_id: 'KDF143625879',
          status: 'PENDING',
          matched_product_items: [
            {
              id: 31,
              productId: 1,
              name: 'Kolev and Kolev - Soft Fit',
              price: 260,
              line_total: 260,
            },
          ],
          matched_item_count: 1,
        },
      ],
      meta: {
        total: 1,
        page: 1,
        limit: 10,
        pages: 1,
      },
    });

    const returnSuccess =
      document.paths['/returns/{id}'].get.responses['200'].content[
        'application/json'
      ].examples.success.value;
    expect(returnSuccess.data).toMatchObject({
      id: 12,
      status: 'PENDING',
      reason: 'Damage Product',
      images: ['https://cdn.bestkid.test/returns/evidence-1.png'],
      chat_room_id: 11,
      order: { id: 41, display_id: 'KDF143625879', status: 'DELIVERED' },
      returned_item: { id: 31, productId: 1 },
      actions: {
        can_message_seller: true,
        can_update_status: false,
      },
    });

    const deliverySuccess =
      document.paths['/delivery/me'].get.responses['200'].content[
        'application/json'
      ].examples.success.value;
    expect(deliverySuccess.data).toEqual({
      data: expect.objectContaining({
        id: 3,
        sellerId: 7,
        domestic_partner: 'Speedy',
        international_partner: 'DHL Express',
      }),
    });

    const messagesSuccess =
      document.paths['/chat/rooms/{id}/messages'].get.responses['200'].content[
        'application/json'
      ].examples.paginated_success.value;
    expect(messagesSuccess.data).toMatchObject({
      room: { id: 11, messaging_available: true },
      data: [{ id: 19, chatRoomId: 11, senderId: 22, type: 'TEXT' }],
      meta: { total: 1, page: 1, limit: 20, pages: 1 },
    });

    const trendingSuccess =
      document.paths['/home/trending'].get.responses['200'].content[
        'application/json'
      ].examples.paginated_success.value;
    expect(trendingSuccess).toMatchObject({
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
          views: 128,
          category: { id: 1, name: 'Kids' },
          effective_price: 18,
          is_wishlisted: false,
        },
      ],
      meta: { total: 24, page: 1, limit: 20, pages: 2 },
    });

    const newArrivalsSuccess =
      document.paths['/home/new-arrivals'].get.responses['200'].content[
        'application/json'
      ].examples.paginated_success.value;
    expect(newArrivalsSuccess).toMatchObject({
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: [
        {
          id: 1,
          name: 'Kids Cotton Hoodie - Soft Fit',
          original_price: 21.99,
          discounted_price: 18,
          category: { id: 1, name: 'Kids' },
          effective_price: 18,
          is_wishlisted: false,
        },
      ],
      meta: { total: 24, page: 1, limit: 20, pages: 2 },
    });

    const recentlyViewedSuccess =
      document.paths['/home/recently-viewed'].get.responses['200'].content[
        'application/json'
      ].examples.paginated_success.value;
    expect(recentlyViewedSuccess).toMatchObject({
      success: true,
      statusCode: 200,
      message: 'Request successful',
      data: [
        {
          id: 1,
          name: 'Kids Cotton Hoodie - Soft Fit',
          original_price: 21.99,
          discounted_price: 18,
          status: 'ACTIVE',
          category: { id: 1, name: 'Kids' },
          viewed_at: '2026-07-09T12:00:00.000Z',
        },
      ],
      meta: { total: 1, page: 1, limit: 10, pages: 1 },
    });

    const buyNowSessionSuccess =
      document.paths['/stripe/buy-now-session'].post.responses['201'].content[
        'application/json'
      ].examples.created_success.value;
    expect(buyNowSessionSuccess).toMatchObject({
      success: true,
      statusCode: 201,
      message: 'Request successful',
      data: {
        session_id: 'cs_test_buy_now_123456789',
        url: 'https://checkout.stripe.com/c/pay/cs_test_buy_now_123456789',
        currency: 'eur',
        amount_total: 264.99,
        checkout_summary: {
          cart_item_count: 1,
          selected_seller_ids: [7],
          seller_groups: [
            {
              items: [
                {
                  id: null,
                  productId: 1,
                  price: 260,
                  line_total: 260,
                },
              ],
              subtotal: 260,
              delivery_cost: 4.99,
              discount_amount: 0,
              total: 264.99,
            },
          ],
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
    });
  });
});
