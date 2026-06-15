import { UserRole } from "generated/prisma/enums"

export type TokenPayload = {
    id: number
    role: UserRole,
    email: string,

}