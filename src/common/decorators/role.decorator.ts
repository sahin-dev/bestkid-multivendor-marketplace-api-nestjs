import { SetMetadata } from "@nestjs/common"

export const ROLES_KEY = "Roles"

export const Roles = (...roles:String[]) => SetMetadata(ROLES_KEY, roles)