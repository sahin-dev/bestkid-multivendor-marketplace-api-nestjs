import { escapeHtml } from "./escapeHtml";

export default function contactReplyTemplate(params: { name: string; reply: string }) {
    return `
    <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
        <p>Hello ${escapeHtml(params.name)},</p>
        <p style="white-space: pre-line;">${escapeHtml(params.reply)}</p>
        <p>The BestKid support team</p>
    </div>`;
}
