import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { AuthProvider } from '../auth/providers/AuthProvider';
import { SendMessageDto } from './dtos/send-message.dto';
import { corsOriginDelegate } from 'src/config/cors.config';

@WebSocketGateway({
  maxHttpBufferSize: 64 * 1024,
  cors: {
    origin: corsOriginDelegate,
    credentials: true,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly chatService: ChatService,
    private readonly authProvider: AuthProvider,
  ) {}

  async handleConnection(socket: Socket) {
    try {
      // Extract token from handshake auth or headers
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.split(' ')[1];
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
      this.logger.debug(`Socket client connected: ${socket.id}, User: ${user.id}`);
    } catch (err) {
      socket.disconnect();
    }
  }

  handleDisconnect(socket: Socket) {
    this.logger.debug(`Socket client disconnected: ${socket.id}`);
  }

  @SubscribeMessage('join_room')
  async handleJoinRoom(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { chatRoomId: number },
  ) {
    const user = socket.data.user;
    if (!user) return;

    try {
      await this.chatService.verifyRoomParticipant(data.chatRoomId, user.id);
    } catch {
      socket.emit('error', 'You do not have access to this room');
      return;
    }

    socket.join(`room_${data.chatRoomId}`);
  }

  @SubscribeMessage('leave_room')
  handleLeaveRoom(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { chatRoomId: number },
  ) {
    socket.leave(`room_${data.chatRoomId}`);
  }

  @SubscribeMessage('send_message')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async handleSendMessage(
    @ConnectedSocket() socket: Socket,
    @MessageBody() dto: SendMessageDto,
  ) {
    const user = socket.data.user;
    if (!user) return;

    try {
      const message = await this.chatService.saveMessage(user.id, dto);
      // Broadcast message to room
      this.server.to(`room_${dto.chatRoomId}`).emit('new_message', message);
    } catch (err: any) {
      socket.emit('error', err.message || 'Failed to send message');
    }
  }

  @SubscribeMessage('mark_read')
  async handleMarkRead(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { chatRoomId: number },
  ) {
    const user = socket.data.user;
    if (!user) return;

    try {
      await this.chatService.markMessagesRead(data.chatRoomId, user.id);
      // Broadcast message read receipt
      this.server.to(`room_${data.chatRoomId}`).emit('messages_read', {
        chatRoomId: data.chatRoomId,
        readerId: user.id,
      });
    } catch (err: any) {
      socket.emit('error', err.message || 'Failed to mark read');
    }
  }

  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { chatRoomId: number; isTyping: boolean },
  ) {
    const user = socket.data.user;
    if (!user || !socket.rooms.has(`room_${data.chatRoomId}`)) return;

    socket.to(`room_${data.chatRoomId}`).emit('user_typing', {
      chatRoomId: data.chatRoomId,
      userId: user.id,
      isTyping: data.isTyping,
    });
  }
}
