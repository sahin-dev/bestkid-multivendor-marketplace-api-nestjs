import { registerAs } from "@nestjs/config";

export const firebaseConfig = () => ({
    // Path to service account JSON file (relative to project root)
    serviceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH,

    // Service account JSON as string (for production/Docker)
    serviceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT_JSON,

    // Project ID (optional, for validation)
    projectId: process.env.FIREBASE_PROJECT_ID,

    // Legacy support
    firebase_secrets: process.env.FIREBASE_SECRETS
});

export default registerAs("firebase", firebaseConfig);