import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { GetUser } from "src/common/decorators";
import { PaginationDto } from "src/common/dtos/pagination.dto";
import { ChatService } from "./chat.service";
import { CreateRoomDto } from "./dtos/create-room.dto";
import { MessagesQueryDto } from "./dtos/messages-query.dto";

@ApiTags("Chat")
@Controller("chat")
@ApiBearerAuth("access-token")
export class ChatController {
    constructor(private readonly chatService: ChatService) {}

    @Post("rooms")
    @ApiOperation({ summary: "Find or create a chat room with a seller" })
    @ApiBody({ type: CreateRoomDto })
    @ApiResponse({ status: 201, description: "Chat room returned" })
    async findOrCreateRoom(@GetUser("id") userId: number, @Body() dto: CreateRoomDto) {
        return this.chatService.findOrCreateRoom(userId, dto.sellerId);
    }

    @Get("rooms")
    @ApiOperation({ summary: "List my chat rooms" })
    @ApiQuery({ name: "page", required: false, type: Number })
    @ApiQuery({ name: "limit", required: false, type: Number })
    async getUserRooms(@GetUser("id") userId: number, @Query() query: PaginationDto) {
        return this.chatService.getUserRooms(userId, query);
    }

    @Get("rooms/:id/messages")
    @ApiOperation({ summary: "List messages in a chat room" })
    @ApiParam({ name: "id", type: Number })
    @ApiQuery({ name: "page", required: false, type: Number })
    @ApiQuery({ name: "limit", required: false, type: Number })
    async getRoomMessages(
        @Param("id", ParseIntPipe) roomId: number,
        @GetUser("id") userId: number,
        @Query() query: MessagesQueryDto,
    ) {
        return this.chatService.getRoomMessages(roomId, userId, query);
    }

    @Patch("rooms/:id/read")
    @ApiOperation({ summary: "Mark all messages in a chat room as read" })
    @ApiParam({ name: "id", type: Number })
    async markMessagesRead(
        @Param("id", ParseIntPipe) roomId: number,
        @GetUser("id") userId: number,
    ) {
        return this.chatService.markMessagesRead(roomId, userId);
    }
}
