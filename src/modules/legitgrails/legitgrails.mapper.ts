import { AuthenticationStatus } from "generated/prisma/client";

export type LegitGrailsOrderStatus = "queued" | "processing" | "update-photos" | "completed" | "error";
export type LegitGrailsOutcome = "authentic" | "fake" | "unable-to-verify" | "canceled";

export type LegitGrailsMappedResult = {
    externalOrderId?: string;
    deliveryId?: string;
    providerStatus: string;
    outcome?: LegitGrailsOutcome;
    productStatus: AuthenticationStatus;
    isTerminal: boolean;
    hasVerdict: boolean;
    certificateUrl?: string;
    outcomeReasons?: string[];
    outcomeIndexes?: string[];
    photosToResubmit?: unknown[];
};

/**
 * Maps a LegitGrails order detail response (GET /orders/{id}) or webhook payload
 * (order-outcome / update-photos) to our internal representation. Both share the
 * order-detail schema per LegitGrails' docs.
 */
export function mapLegitGrailsResult(payload: any): LegitGrailsMappedResult {
    const externalOrderId = stringValue(payload?.id);
    const deliveryId = stringValue(payload?.delivery_id);
    const status = stringValue(payload?.status) ?? "queued";
    const outcome = stringValue(payload?.outcome) as LegitGrailsOutcome | undefined;

    // Only a completed order with a genuine verdict (authentic/fake/unable-to-verify) should
    // move the product out of PENDING; `canceled` and `error` leave it for manual follow-up.
    const productStatus =
        status === "completed" && outcome === "authentic"
            ? AuthenticationStatus.VERIFIED
            : status === "completed" && (outcome === "fake" || outcome === "unable-to-verify")
              ? AuthenticationStatus.NOT_VERIFIED
              : AuthenticationStatus.PENDING;

    return {
        externalOrderId,
        deliveryId,
        providerStatus: status,
        outcome,
        productStatus,
        isTerminal: status === "completed" || status === "error",
        hasVerdict: productStatus !== AuthenticationStatus.PENDING,
        certificateUrl: stringValue(payload?.certificate_url),
        outcomeReasons: Array.isArray(payload?.outcome_reasons) ? payload.outcome_reasons : undefined,
        outcomeIndexes: Array.isArray(payload?.outcome_indexes) ? payload.outcome_indexes : undefined,
        photosToResubmit: Array.isArray(payload?.photos_to_resubmit) ? payload.photos_to_resubmit : undefined,
    };
}

function stringValue(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
