import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiQuery, ApiTags } from "@nestjs/swagger";
import { Roles } from "src/common/decorators";
import { AdminUserService } from "../providers/admin-user.service";
import { UserRole } from "generated/prisma/client";
import { UpdateUserRoleDto } from "../dtos/update-user-role.dto";

@ApiTags("User Management")
@Controller("users")
@ApiBearerAuth("access-token")
@Roles("ADMIN")
export class UserController {
    constructor(private readonly adminUserService: AdminUserService) {}

    @Get()
    @ApiQuery({ name: "page", required: false, type: Number })
    @ApiQuery({ name: "limit", required: false, type: Number })
    @ApiQuery({ name: "search", required: false, type: String })
    async findAllUsers(
        @Query("page") page?: number,
        @Query("limit") limit?: number,
        @Query("search") search?: string,
    ) {
        const p = page ? Number(page) : 1;
        const l = limit ? Number(limit) : 10;
        return this.adminUserService.findAllUsers(p, l, search);
    }

    @Get("admin/all")
    @ApiQuery({ name: "page", required: false, type: Number })
    @ApiQuery({ name: "limit", required: false, type: Number })
    @ApiQuery({ name: "search", required: false, type: String })
    @ApiQuery({ name: "role", required: false, enum: UserRole })
    @ApiQuery({ name: "isBlocked", required: false, type: Boolean })
    async findAllUsersAdmin(
        @Query("page") page?: number,
        @Query("limit") limit?: number,
        @Query("search") search?: string,
        @Query("role") role?: UserRole,
        @Query("isBlocked") isBlocked?: string,
    ) {
        const p = page ? Number(page) : 1;
        const l = limit ? Number(limit) : 10;
        const blocked = isBlocked === "true" ? true : isBlocked === "false" ? false : undefined;
        return this.adminUserService.findAllUsers(p, l, search, role, blocked);
    }

    @Get("admin/:id")
    async findUserDetail(@Param("id", ParseIntPipe) id: number) {
        return this.adminUserService.findUserDetail(id);
    }

    @Patch("admin/:id/block")
    async toggleBlockUser(@Param("id", ParseIntPipe) id: number) {
        return this.adminUserService.toggleBlockUser(id);
    }

    @Patch("admin/:id/role")
    async updateUserRole(
        @Param("id", ParseIntPipe) id: number,
        @Body() dto: UpdateUserRoleDto,
    ) {
        return this.adminUserService.updateUserRole(id, dto.role);
    }

    @Patch(":id/block")
    async blockUser(@Param("id", ParseIntPipe) id: number) {
        return this.adminUserService.blockUser(id);
    }

    @Patch(":id/unblock")
    async unblockUser(@Param("id", ParseIntPipe) id: number) {
        return this.adminUserService.unblockUser(id);
    }

    @Delete(":id")
    async deleteUser(@Param("id", ParseIntPipe) id: number) {
        return this.adminUserService.deleteUser(id);
    }
}