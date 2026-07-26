import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaginationDto } from 'src/common/dtos/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { SendMessageDto } from './dtos/send-message.dto';
import { MessagesQueryDto } from './dtos/messages-query.dto';
import { ChatRoomsQueryDto } from './dtos/chat-rooms-query.dto';
import { assertEntityExists } from 'src/common/validators/entity-exists.validator';

@Injectable()
export class ChatService {
  constructor(private readonly prismaService: PrismaService) {}

  async findOrCreateRoom(buyerId: number, sellerId: number) {
    if (buyerId === sellerId) {
      throw new BadRequestException('You cannot start a chat with yourself');
    }

    await assertEntityExists(this.prismaService.baseUser, 'Buyer', buyerId);

    // Verify seller exists and is indeed a seller or admin
    const seller = await this.prismaService.baseUser.findUnique({
      where: { id: sellerId },
    });
    if (!seller) {
      throw new NotFoundException(`Seller with ID ${sellerId} not found`);
    }

    const existing = await this.prismaService.chatRoom.findUnique({
      where: { buyerId_sellerId: { buyerId, sellerId } },
    });

    if (existing) {
      return this.prismaService.chatRoom.update({
        where: { id: existing.id },
        data: this.getRestoreVisibilityData(existing, buyerId),
      });
    }

    return this.prismaService.chatRoom.create({
      data: {
        buyerId,
        sellerId,
      },
    });
  }

  async getUserRooms(
    userId: number,
    query: ChatRoomsQueryDto = { page: 1, limit: 10 },
  ) {
    const { page = 1, limit = 10, search } = query ?? {};
    const skip = (page - 1) * limit;
    const where = this.getRoomsWhereClause(userId, search);

    const [rooms, total] = await Promise.all([
      this.prismaService.chatRoom.findMany({
        where,
        skip,
        take: limit,
        include: {
          buyer: {
            select: {
              id: true,
              email: true,
              seller_tier: true,
              profile: { select: { full_name: true, avatar_url: true } },
            },
          },
          seller: {
            select: {
              id: true,
              email: true,
              seller_tier: true,
              profile: { select: { full_name: true, avatar_url: true } },
            },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          _count: {
            select: {
              messages: {
                where: { senderId: { not: userId }, is_read: false },
              },
            },
          },
        },
        orderBy: {
          updatedAt: 'desc',
        },
      }),
      this.prismaService.chatRoom.count({ where }),
    ]);

    const data = rooms.map((room) => this.formatRoom(room, userId));

    return {
      data,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
    };
  }

  async getRoomMessages(
    roomId: number,
    userId: number,
    query: MessagesQueryDto,
  ) {
    const room = await this.prismaService.chatRoom.findUnique({
      where: { id: roomId },
      include: {
        buyer: {
          select: {
            id: true,
            email: true,
            seller_tier: true,
            profile: { select: { full_name: true, avatar_url: true } },
          },
        },
        seller: {
          select: {
            id: true,
            email: true,
            seller_tier: true,
            profile: { select: { full_name: true, avatar_url: true } },
          },
        },
      },
    });

    if (!room) {
      throw new NotFoundException(`Chat room with ID ${roomId} not found`);
    }

    if (room.buyerId !== userId && room.sellerId !== userId) {
      throw new ForbiddenException(
        'You are not a participant of this chat room',
      );
    }

    if (this.isDeletedForUser(room, userId)) {
      return {
        room: this.formatRoom(
          { ...room, messages: [], _count: { messages: 0 } },
          userId,
        ),
        data: [],
        meta: {
          total: 0,
          page: query?.page ?? 1,
          limit: query?.limit ?? 20,
          pages: 0,
        },
      };
    }

    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prismaService.chatMessage.findMany({
        where: { chatRoomId: roomId },
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          sender: {
            select: {
              id: true,
              profile: { select: { full_name: true, avatar_url: true } },
            },
          },
        },
      }),
      this.prismaService.chatMessage.count({ where: { chatRoomId: roomId } }),
    ]);

    return {
      room: this.formatRoom(
        { ...room, messages: [], _count: { messages: 0 } },
        userId,
      ),
      data: data.reverse(), // reverse to display chronological order
      meta: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async saveMessage(senderId: number, dto: SendMessageDto) {
    const room = await this.prismaService.chatRoom.findUnique({
      where: { id: dto.chatRoomId },
    });

    if (!room) {
      throw new NotFoundException(
        `Chat room with ID ${dto.chatRoomId} not found`,
      );
    }

    if (room.buyerId !== senderId && room.sellerId !== senderId) {
      throw new ForbiddenException(
        'You are not a participant of this chat room',
      );
    }

    if (room.blocked_by_user_id) {
      throw new ForbiddenException(
        'Messaging is unavailable in this conversation',
      );
    }

    return this.prismaService.$transaction(async (tx) => {
      const msg = await tx.chatMessage.create({
        data: {
          chatRoomId: dto.chatRoomId,
          senderId,
          message: dto.message,
          file_url: dto.file_url,
          type: dto.type,
          is_delivered: true, // assume delivered if real-time
        },
        include: {
          sender: {
            select: {
              id: true,
              profile: { select: { full_name: true, avatar_url: true } },
            },
          },
        },
      });

      // Update room's updatedAt field
      await tx.chatRoom.update({
        where: { id: dto.chatRoomId },
        data: {
          ...this.getRestoreVisibilityData(room, senderId),
          updatedAt: new Date(),
        },
      });

      return msg;
    });
  }

  async markMessagesRead(roomId: number, userId: number) {
    const room = await this.prismaService.chatRoom.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      throw new NotFoundException(`Chat room with ID ${roomId} not found`);
    }

    if (room.buyerId !== userId && room.sellerId !== userId) {
      throw new ForbiddenException(
        'You are not a participant of this chat room',
      );
    }

    await this.prismaService.chatMessage.updateMany({
      where: {
        chatRoomId: roomId,
        senderId: { not: userId },
        is_read: false,
      },
      data: {
        is_read: true,
      },
    });

    return { message: 'Messages marked as read' };
  }

  async blockRoom(roomId: number, userId: number) {
    const room = await this.ensureRoomParticipant(roomId, userId);
    if (room.blocked_by_user_id === userId) {
      return this.getRoomByIdForUser(roomId, userId);
    }

    if (room.blocked_by_user_id && room.blocked_by_user_id !== userId) {
      throw new ForbiddenException(
        'Only the user who blocked this conversation can change this state',
      );
    }

    await this.prismaService.chatRoom.update({
      where: { id: roomId },
      data: { blocked_by_user_id: userId, blocked_at: new Date() },
    });

    return this.getRoomByIdForUser(roomId, userId);
  }

  async unblockRoom(roomId: number, userId: number) {
    const room = await this.ensureRoomParticipant(roomId, userId);
    if (!room.blocked_by_user_id) {
      return this.getRoomByIdForUser(roomId, userId);
    }

    if (room.blocked_by_user_id !== userId) {
      throw new ForbiddenException(
        'Only the user who blocked this conversation can unblock it',
      );
    }

    await this.prismaService.chatRoom.update({
      where: { id: roomId },
      data: { blocked_by_user_id: null, blocked_at: null },
    });

    return this.getRoomByIdForUser(roomId, userId);
  }

  async deleteRoomForUser(roomId: number, userId: number) {
    const room = await this.ensureRoomParticipant(roomId, userId);
    const data =
      room.buyerId === userId
        ? { buyer_deleted_at: new Date() }
        : { seller_deleted_at: new Date() };

    await this.prismaService.chatRoom.update({ where: { id: roomId }, data });
    return { message: 'Conversation deleted from your messages' };
  }

  async verifyRoomParticipant(roomId: number, userId: number) {
    await this.ensureRoomParticipant(roomId, userId);
    return { can_access: true };
  }

  private getRoomsWhereClause(userId: number, search?: string) {
    const buyerVisible: any = { buyerId: userId, buyer_deleted_at: null };
    const sellerVisible: any = { sellerId: userId, seller_deleted_at: null };

    if (search) {
      buyerVisible.seller = {
        OR: [
          { email: { contains: search, mode: 'insensitive' } },
          { profile: { full_name: { contains: search, mode: 'insensitive' } } },
        ],
      };
      sellerVisible.buyer = {
        OR: [
          { email: { contains: search, mode: 'insensitive' } },
          { profile: { full_name: { contains: search, mode: 'insensitive' } } },
        ],
      };
    }

    return { OR: [buyerVisible, sellerVisible] };
  }

  private async ensureRoomParticipant(roomId: number, userId: number) {
    const room = await this.prismaService.chatRoom.findUnique({
      where: { id: roomId },
    });
    if (!room) {
      throw new NotFoundException(`Chat room with ID ${roomId} not found`);
    }
    if (room.buyerId !== userId && room.sellerId !== userId) {
      throw new ForbiddenException(
        'You are not a participant of this chat room',
      );
    }
    return room;
  }

  private async getRoomByIdForUser(roomId: number, userId: number) {
    const room = await this.prismaService.chatRoom.findUnique({
      where: { id: roomId },
      include: {
        buyer: {
          select: {
            id: true,
            email: true,
            seller_tier: true,
            profile: { select: { full_name: true, avatar_url: true } },
          },
        },
        seller: {
          select: {
            id: true,
            email: true,
            seller_tier: true,
            profile: { select: { full_name: true, avatar_url: true } },
          },
        },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        _count: {
          select: {
            messages: { where: { senderId: { not: userId }, is_read: false } },
          },
        },
      },
    });
    if (!room) {
      throw new NotFoundException(`Chat room with ID ${roomId} not found`);
    }
    return this.formatRoom(room, userId);
  }

  private isDeletedForUser(
    room: {
      buyerId: number;
      sellerId: number;
      buyer_deleted_at?: Date | null;
      seller_deleted_at?: Date | null;
    },
    userId: number,
  ) {
    return room.buyerId === userId
      ? Boolean(room.buyer_deleted_at)
      : Boolean(room.seller_deleted_at);
  }

  private getRestoreVisibilityData(
    room: { buyerId: number; sellerId: number },
    userId: number,
  ) {
    if (room.buyerId === userId) {
      return { buyer_deleted_at: null, seller_deleted_at: null };
    }

    return { seller_deleted_at: null, buyer_deleted_at: null };
  }

  private formatRoom(room: any, userId: number) {
    const partner = room.buyerId === userId ? room.seller : room.buyer;
    const lastMessage = room.messages?.[0] || null;
    const blockedByMe = room.blocked_by_user_id === userId;
    const blockedByPartner = Boolean(
      room.blocked_by_user_id && room.blocked_by_user_id !== userId,
    );
    const deletedForMe = this.isDeletedForUser(room, userId);

    return {
      id: room.id,
      partner,
      lastMessage,
      unread_count: room._count?.messages ?? 0,
      is_blocked: Boolean(room.blocked_by_user_id),
      blocked_by_me: blockedByMe,
      blocked_by_partner: blockedByPartner,
      blocked_at: room.blocked_at,
      deleted_for_me: deletedForMe,
      messaging_available: !room.blocked_by_user_id && !deletedForMe,
      unavailable_reason: deletedForMe
        ? 'DELETED'
        : blockedByMe
          ? 'BLOCKED_BY_ME'
          : blockedByPartner
            ? 'BLOCKED_BY_PARTNER'
            : null,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
    };
  }
}
