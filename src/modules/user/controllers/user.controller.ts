import { Controller, Delete, Get, Param, ParseIntPipe, Patch, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiQuery, ApiTags } from "@nestjs/swagger";
import { Roles } from "src/common/decorators";
import { AdminUserService } from "../providers/admin-user.service";

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