import { escapeHtml } from "./escapeHtml";

type OrderEmail = {
    name: string;
    orderReference: string;
    itemNames: string[];
};

type OrderPaidEmail = OrderEmail & {
    amount: string;
    deliveryAddress: string;
    otherPartyName: string;
};

const layout = (name: string, content: string) => `
<div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6; max-width: 600px; margin: 0 auto;">
    <p>Hello ${escapeHtml(name)},</p>
    ${content}
    <p>The BestKid team</p>
</div>`;

const itemList = (itemNames: string[]) =>
    `<ul>${itemNames.map((itemName) => `<li>${escapeHtml(itemName)}</li>`).join("")}</ul>`;

const detail = (label: string, value: string) =>
    `<p style="margin: 4px 0;"><strong>${label}:</strong> ${escapeHtml(value)}</p>`;

export function orderConfirmationEmail(data: OrderPaidEmail) {
    return layout(
        data.name,
        `<p>Thank you for your purchase. Your payment was received and your order is confirmed.</p>
        ${detail("Order", data.orderReference)}
        ${detail("Seller", data.otherPartyName)}
        ${detail("Total paid", data.amount)}
        ${detail("Delivery address", data.deliveryAddress)}
        ${itemList(data.itemNames)}
        <p>You can follow your order from the Orders page in your account.</p>`,
    );
}

export function newSaleEmail(data: OrderPaidEmail) {
    return layout(
        data.name,
        `<p>Good news: one of your items has sold and payment has been received.</p>
        ${detail("Order", data.orderReference)}
        ${detail("Buyer", data.otherPartyName)}
        ${detail("Deliver to", data.deliveryAddress)}
        ${itemList(data.itemNames)}
        <p>Please prepare the order for shipping, then update its status from the Selling page.</p>`,
    );
}

export function orderCancelledEmail(data: OrderEmail & { refundNote: string }) {
    return layout(
        data.name,
        `<p>Your order ${escapeHtml(data.orderReference)} has been cancelled.</p>
        ${itemList(data.itemNames)}
        <p>${escapeHtml(data.refundNote)}</p>`,
    );
}
