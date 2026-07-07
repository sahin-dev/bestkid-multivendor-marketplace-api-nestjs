import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Roles } from "src/common/decorators";
import { AdminService } from "./admin.service";
import { AdminPeriod, AdminPeriodQueryDto } from "./dtos/admin-period-query.dto";
import { AdminEarningsQueryDto } from "./dtos/admin-earnings-query.dto";

@ApiTags("Admin Dashboard")
@ApiBearerAuth("access-token")
@Roles("ADMIN")
@Controller("admin")
export class AdminController {
    constructor(private readonly adminService: AdminService) {}

    @Get("dashboard")
    @ApiOperation({ summary: "Admin: get dashboard cards, activity, and recently joined users" })
    @ApiQuery({ name: "period", required: false, enum: AdminPeriod })
    @ApiResponse({
        status: 200,
        description: "Dashboard data for admin landing screen",
        schema: {
            example: {
                cards: { totalUsers: 77, totalEarnings: 4600, totalSupport: 16 },
                activity: {
                    period: "TODAY",
                    rows: [
                        {
                            key: "NEW_USERS_JOINED",
                            label: "New Users Joined",
                            value: 12,
                            previousValue: 10,
                            percentage: 20,
                            direction: "HIGHER",
                        },
                    ],
                },
                recentlyJoinedUsers: [],
            },
        },
    })
    getDashboard(@Query() query: AdminPeriodQueryDto) {
        return this.adminService.getDashboard(query.period);
    }

    @Get("dashboard/activity")
    @ApiOperation({ summary: "Admin: get dashboard activity for a selected period" })
    @ApiQuery({ name: "period", required: false, enum: AdminPeriod })
    getActivity(@Query() query: AdminPeriodQueryDto) {
        return this.adminService.getActivity(query.period);
    }

    @Get("earnings")
    @ApiOperation({ summary: "Admin: get platform earnings matrix and transaction history" })
    @ApiQuery({ name: "period", required: false, enum: AdminPeriod })
    @ApiQuery({ name: "page", required: false, type: Number })
    @ApiQuery({ name: "limit", required: false, type: Number })
    @ApiResponse({
        status: 200,
        description: "Earnings matrix and paginated transaction rows",
        schema: {
            example: {
                period: "TODAY",
                matrix: { earnings: 435, previousEarnings: 414, percentage: 5, direction: "HIGHER" },
                transactions: [{ sl: 1, pay_on: "2026-07-12T10:00:00.000Z", txn_id: "TXN000001", amount: 9.95 }],
                meta: { total: 1, page: 1, limit: 10, pages: 1 },
            },
        },
    })
    getEarnings(@Query() query: AdminEarningsQueryDto) {
        return this.adminService.getEarnings(query);
    }
}
