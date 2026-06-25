import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    OnGatewayConnection,
    OnGatewayDisconnect,
    ConnectedSocket,
    MessageBody,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { ChatService } from "./chat.service";
import { AuthProvider } from "../auth/providers/AuthProvider";
import { SendMessageDto } from "./dtos/send-message.dto";

@WebSocketGateway({
    cors: {
        origin: "*",
    },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    constructor(
        private readonly chatService: ChatService,
        private readonly authProvider: AuthProvider,
    ) {}

    async handleConnection(socket: Socket) {
        try {
            // Extract token from handshake auth or headers
            const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(" ")[1];
            if (!token) {
                socket.disconnect();
                return;
            }

            const user = await this.authProvider.verifyToken(token);
            if (!user || user.is_blocked) {
                socket.disconnect();
                return;
            }

            // Store user in socket object for easy access
            socket.data.user = user;
            console.log(`Socket client connected: ${socket.id}, User: ${user.id}`);
        } catch (err) {
            socket.disconnect();
        }
    }

    handleDisconnect(socket: Socket) {
        console.log(`Socket client disconnected: ${socket.id}`);
    }

    @SubscribeMessage("join_room")
    async handleJoinRoom(
        @ConnectedSocket() socket: Socket,
        @MessageBody() data: { chatRoomId: number },
    ) {
        const user = socket.data.user;
        if (!user) return;

        // Verify if room belongs to user
        const rooms = await this.chatService.getUserRooms(user.id);
        const hasRoom = rooms.some((r) => r.id === data.chatRoomId);
        if (!hasRoom) {
            socket.emit("error", "You do not have access to this room");
            return;
        }

        socket.join(`room_${data.chatRoomId}`);
        console.log(`User ${user.id} joined room_${data.chatRoomId}`);
    }

    @SubscribeMessage("leave_room")
    handleLeaveRoom(
        @ConnectedSocket() socket: Socket,
        @MessageBody() data: { chatRoomId: number },
    ) {
        socket.leave(`room_${data.chatRoomId}`);
        console.log(`User ${socket.data.user?.id} left room_${data.chatRoomId}`);
    }

    @SubscribeMessage("send_message")
    async handleSendMessage(
        @ConnectedSocket() socket: Socket,
        @MessageBody() dto: SendMessageDto,
    ) {
        const user = socket.data.user;
        if (!user) return;

        try {
            const message = await this.chatService.saveMessage(user.id, dto);
            // Broadcast message to room
            this.server.to(`room_${dto.chatRoomId}`).emit("new_message", message);
        } catch (err) {
            socket.emit("error", err.message || "Failed to send message");
        }
    }

    @SubscribeMessage("mark_read")
    async handleMarkRead(
        @ConnectedSocket() socket: Socket,
        @MessageBody() data: { chatRoomId: number },
    ) {
        const user = socket.data.user;
        if (!user) return;

        try {
            await this.chatService.markMessagesRead(data.chatRoomId, user.id);
            // Broadcast message read receipt
            this.server.to(`room_${data.chatRoomId}`).emit("messages_read", {
                chatRoomId: data.chatRoomId,
                readerId: user.id,
            });
        } catch (err) {
            socket.emit("error", err.message || "Failed to mark read");
        }
    }

    @SubscribeMessage("typing")
    handleTyping(
        @ConnectedSocket() socket: Socket,
        @MessageBody() data: { chatRoomId: number; isTyping: boolean },
    ) {
        const user = socket.data.user;
        if (!user) return;

        socket.to(`room_${data.chatRoomId}`).emit("user_typing", {
            chatRoomId: data.chatRoomId,
            userId: user.id,
            isTyping: data.isTyping,
        });
    }
}
