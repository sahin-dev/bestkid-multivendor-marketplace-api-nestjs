import { AuthenticationStatus } from "generated/prisma/client";

export type LegitGrailsMappedResult = {
    externalOrderId?: string;
    providerStatus: string;
    verdict?: string;
    productStatus: AuthenticationStatus;
    certificateUrl?: string;
    reportUrl?: string;
    completed: boolean;
};

export function mapLegitGrailsResult(payload: any): LegitGrailsMappedResult {
    const externalOrderId = stringValue(
        payload?.id ??
            payload?.order_id ??
            payload?.orderId ??
            payload?.request_id ??
            payload?.requestId ??
            payload?.authentication_id ??
            payload?.authenticationId,
    );
    const rawStatus = stringValue(payload?.status ?? payload?.state) ?? "SUBMITTED";
    const verdict = stringValue(payload?.verdict ?? payload?.result ?? payload?.outcome);
    const normalized = `${rawStatus} ${verdict ?? ""}`.toLowerCase();

    if (/(authentic|verified|approved|pass|passed|genuine)/i.test(normalized) && !/(not authentic|fake|rejected|failed)/i.test(normalized)) {
        return {
            externalOrderId,
            providerStatus: rawStatus,
            verdict,
            productStatus: AuthenticationStatus.VERIFIED,
            certificateUrl: stringValue(payload?.certificate_url ?? payload?.certificateUrl ?? payload?.certificate?.url),
            reportUrl: stringValue(payload?.report_url ?? payload?.reportUrl ?? payload?.report?.url),
            completed: true,
        };
    }

    if (/(not authentic|fake|rejected|failed|counterfeit)/i.test(normalized)) {
        return {
            externalOrderId,
            providerStatus: rawStatus,
            verdict,
            productStatus: AuthenticationStatus.NOT_VERIFIED,
            certificateUrl: stringValue(payload?.certificate_url ?? payload?.certificateUrl ?? payload?.certificate?.url),
            reportUrl: stringValue(payload?.report_url ?? payload?.reportUrl ?? payload?.report?.url),
            completed: true,
        };
    }

    return {
        externalOrderId,
        providerStatus: rawStatus,
        verdict,
        productStatus: AuthenticationStatus.PENDING,
        certificateUrl: stringValue(payload?.certificate_url ?? payload?.certificateUrl ?? payload?.certificate?.url),
        reportUrl: stringValue(payload?.report_url ?? payload?.reportUrl ?? payload?.report?.url),
        completed: false,
    };
}

function stringValue(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
