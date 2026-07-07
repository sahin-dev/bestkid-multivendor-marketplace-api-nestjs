import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiExcludeEndpoint, ApiOperation, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import { Roles } from "src/common/decorators";
import { AdminUserService } from "../providers/admin-user.service";
import { UserRole } from "generated/prisma/client";
import { UpdateUserRoleDto } from "../dtos/update-user-role.dto";
import { UpdateSellerTierDto } from "../dtos/update-seller-tier.dto";

enum AdminUserStatus {
    ALL = "ALL",
    ACTIVE = "ACTIVE",
    BLOCKED = "BLOCKED",
}

@ApiTags("User Management")
@Controller("users")
@ApiBearerAuth("access-token")
@Roles("ADMIN")
export class UserController {
    constructor(private readonly adminUserService: AdminUserService) {}

    @Get()
    @ApiOperation({ summary: "Admin: list users" })
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
    @ApiOperation({ summary: "Admin: list users with status, role, and search filters" })
    @ApiQuery({ name: "page", required: false, type: Number })
    @ApiQuery({ name: "limit", required: false, type: Number })
    @ApiQuery({ name: "search", required: false, type: String })
    @ApiQuery({ name: "role", required: false, enum: UserRole })
    @ApiQuery({ name: "status", required: false, enum: AdminUserStatus })
    @ApiQuery({ name: "isBlocked", required: false, type: Boolean })
    async findAllUsersAdmin(
        @Query("page") page?: number,
        @Query("limit") limit?: number,
        @Query("search") search?: string,
        @Query("role") role?: UserRole,
        @Query("status") status?: AdminUserStatus,
        @Query("isBlocked") isBlocked?: string,
    ) {
        const p = page ? Number(page) : 1;
        const l = limit ? Number(limit) : 10;
        const blocked =
            status === AdminUserStatus.ACTIVE
                ? false
                : status === AdminUserStatus.BLOCKED
                  ? true
                  : isBlocked === "true"
                    ? true
                    : isBlocked === "false"
                      ? false
                      : undefined;
        return this.adminUserService.findAllUsers(p, l, search, role, blocked);
    }

    @Get("admin/:id")
    @ApiOperation({ summary: "Admin: get user detail with buying and selling statistics" })
    @ApiParam({ name: "id", type: Number })
    async findUserDetail(@Param("id", ParseIntPipe) id: number) {
        return this.adminUserService.findUserDetail(id);
    }

    @Get("admin/:id/products")
    @ApiOperation({ summary: "Admin: list products owned by a user" })
    @ApiParam({ name: "id", type: Number })
    @ApiQuery({ name: "page", required: false, type: Number })
    @ApiQuery({ name: "limit", required: false, type: Number })
    async findUserProducts(
        @Param("id", ParseIntPipe) id: number,
        @Query("page") page?: number,
        @Query("limit") limit?: number,
    ) {
        return this.adminUserService.findUserProducts(id, page ? Number(page) : 1, limit ? Number(limit) : 10);
    }

    @Patch("admin/:id/block")
    @ApiOperation({ summary: "Admin: toggle a user's blocked status" })
    @ApiParam({ name: "id", type: Number })
    async toggleBlockUser(@Param("id", ParseIntPipe) id: number) {
        return this.adminUserService.toggleBlockUser(id);
    }

    @Patch("admin/:id/role")
    @ApiExcludeEndpoint()
    async updateUserRole(
        @Param("id", ParseIntPipe) id: number,
        @Body() dto: UpdateUserRoleDto,
    ) {
        return this.adminUserService.updateUserRole(id, dto.role);
    }

    @Patch("admin/:id/seller-tier")
    @ApiOperation({ summary: "Admin: update a user's seller tier" })
    @ApiParam({ name: "id", type: Number })
    @ApiBody({ type: UpdateSellerTierDto })
    async updateSellerTier(
        @Param("id", ParseIntPipe) id: number,
        @Body() dto: UpdateSellerTierDto,
    ) {
        return this.adminUserService.updateSellerTier(id, dto.seller_tier);
    }

    @Patch(":id/block")
    @ApiOperation({ summary: "Admin: block a user" })
    @ApiParam({ name: "id", type: Number })
    async blockUser(@Param("id", ParseIntPipe) id: number) {
        return this.adminUserService.blockUser(id);
    }

    @Patch(":id/unblock")
    @ApiOperation({ summary: "Admin: unblock a user" })
    @ApiParam({ name: "id", type: Number })
    async unblockUser(@Param("id", ParseIntPipe) id: number) {
        return this.adminUserService.unblockUser(id);
    }

    @Delete(":id")
    @ApiOperation({ summary: "Admin: delete a user" })
    @ApiParam({ name: "id", type: Number })
    async deleteUser(@Param("id", ParseIntPipe) id: number) {
        return this.adminUserService.deleteUser(id);
    }
}
