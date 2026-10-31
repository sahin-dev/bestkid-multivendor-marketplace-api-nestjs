import type { ConfigType } from "@nestjs/config";
import { createDecipheriv, createHash } from "crypto";
import { TbiCreditConfig } from "src/config/tbi-credit.config";
import { TbiCreditClient } from "./tbi-credit.client";

describe("TbiCreditClient", () => {
    const encryptionKey = "test-tbi-encryption-key";
    const applicationData = {
        orderid: "12345",
        items: [{ name: "Test product", qty: 1, price: 99.99, category: 9 }],
        currency: "EUR",
    };
    let originalFetch: typeof fetch;

    beforeEach(() => {
        originalFetch = global.fetch;
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            text: async () => JSON.stringify({ error: 0, order_id: 22 }),
        }) as unknown as typeof fetch;
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    it("uses the TBI Cryptor.php AES-256-CTR wire format", async () => {
        const client = new TbiCreditClient({
            enabled: true,
            country: "BG",
            base_url: "https://beta.tbibank.support",
            reseller_code: "TBI1",
            reseller_key: "EX1",
            encryption_key: encryptionKey,
            currency: "EUR",
            timeout_ms: 15000,
            webhook_secret: undefined,
        } as ConfigType<typeof TbiCreditConfig>);

        await client.registerApplication(applicationData);

        const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
        const requestBody = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
        const encryptedPayload = Buffer.from(requestBody.data, "base64");
        const iv = encryptedPayload.subarray(0, 16);
        const ciphertext = encryptedPayload.subarray(16);
        const key = createHash("sha256").update(encryptionKey).digest();
        const decipher = createDecipheriv("aes-256-ctr", key, iv);
        const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");

        expect(JSON.parse(plaintext)).toEqual(applicationData);
        expect(requestBody).toMatchObject({
            reseller_code: "TBI1",
            reseller_key: "EX1",
        });
    });
});
