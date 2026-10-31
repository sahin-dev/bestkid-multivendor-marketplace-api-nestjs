import { UserRole } from "generated/prisma/enums";

export class TokenPayload {
    id: number;
    role: UserRole;
    email: string;
    iat?: number;
}
export type TokenPayloadType = TokenPayload;