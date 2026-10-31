# BestKid Marketplace API

NestJS and PostgreSQL backend for BestKid, a multi-vendor marketplace of single, unique, authenticated items. The website (`mikaauzyak_website`) and the admin dashboard (`mikaauzyak_dashboard`) are separate repositories that talk to this API.

## Local development

```bash
pnpm install
cp .env.example .env        # then set NODE_ENV=development and fill in local values
pnpm prisma migrate deploy
pnpm prisma generate
pnpm seed:admin
pnpm start:dev
```

Swagger is at `/docs` outside production.

```bash
pnpm test            # unit tests, run serially because parallel ts-jest workers run out of memory
pnpm run build
```

## Deployment

A push to `main` builds, tests, and deploys to EC2 through `.github/workflows/deploy.yml`. It runs `prisma migrate deploy` and reloads PM2. The server reads `$DEPLOY_PATH/shared/.env`, and `shared/uploads` persists across releases.

With `NODE_ENV=production` the API validates its configuration at startup and refuses to boot if something required is missing or unsafe, listing every problem. See `.env.example` for all settings.

### Stripe webhook events

The webhook endpoint is `POST /stripe/webhook`. It must be subscribed to:

- `checkout.session.completed`
- `checkout.session.expired`
- `account.updated`
- `charge.dispute.created`

### Other webhooks

- TBI: `POST /tbi-credit/webhook`. The URL is sent to TBI on each application, built from `API_PUBLIC_URL`. An update is only acted on after confirming the status with TBI's API, unless `TBI_WEBHOOK_SECRET` is set and the signature matches.
- LegitGrails: `POST /legitgrails/webhook`. Requires `LEGITGRAILS_WEBHOOK_SIGNING_SECRET` in production.

## How checkout works

Every product is a single unique item, so a checkout must never sell one twice.

1. Starting checkout creates `PENDING` orders and reserves each item for the buyer (`reserved_until`). Sellers do not see `PENDING` orders.
2. Payment completes through a webhook. `OrderService.finalizePaidOrders` confirms the order, marks items sold, spends the coupon, clears the cart, and notifies both sides. It is safe to run repeatedly for the same payment.
3. If a payment arrives for an order that can no longer be fulfilled, the order is rejected and the buyer refunded automatically.
4. Sessions that expire release their items. A cron job reconciles anything left open, in case a webhook was lost.

Cancelling a paid order refunds the buyer through Stripe, and reverses the seller's transfer. TBI-financed orders are refunded by the bank, so buyers and sellers are sent to support, and an admin completes the order or return once the bank confirms.

Return refunds are paid when a return is marked `COMPLETED`, once the seller has the item back. `APPROVED` only gives the buyer the return address.

### Seller money

Card sellers are paid by Stripe at checkout, less the platform fee for their tier. The fee and the seller's net amount are snapshotted on the order at payment (`platform_fee_percent`, `seller_net_amount`), and a refunded return reduces the net amount.

TBI settles with the platform outside Stripe and sends no settlement signal, so those sellers are paid by an admin. The dashboard shows a payout as due once the order is delivered, and **Pay Seller** sends a transfer from the platform's Stripe balance. Only use it once the bank's money has arrived and that balance can cover it. An open return blocks the payout.

Deleting an account anonymises the user rather than removing rows, because orders and payments must outlive it for the other party and for accounting.
