import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import { GetUser } from "src/common/decorators";
import { ChatService } from "./chat.service";
import { CreateRoomDto } from "./dtos/create-room.dto";
import { MessagesQueryDto } from "./dtos/messages-query.dto";

@ApiTags("Chat")
@Controller("chat")
@ApiBearerAuth("access-token")
export class ChatController {
    constructor(private readonly chatService: ChatService) {}

    @Post("rooms")
    @ApiBody({ type: CreateRoomDto })
    async findOrCreateRoom(@GetUser("id") userId: number, @Body() dto: CreateRoomDto) {
        return this.chatService.findOrCreateRoom(userId, dto.sellerId);
    }

    @Get("rooms")
    async getUserRooms(@GetUser("id") userId: number) {
        return this.chatService.getUserRooms(userId);
    }

    @Get("rooms/:id/messages")
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
    async markMessagesRead(
        @Param("id", ParseIntPipe) roomId: number,
        @GetUser("id") userId: number,
    ) {
        return this.chatService.markMessagesRead(roomId, userId);
    }
}
