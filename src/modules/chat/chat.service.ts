import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { SendMessageDto } from "./dtos/send-message.dto";
import { MessagesQueryDto } from "./dtos/messages-query.dto";

@Injectable()
export class ChatService {
    constructor(private readonly prismaService: PrismaService) {}

    async findOrCreateRoom(buyerId: number, sellerId: number) {
        if (buyerId === sellerId) {
            throw new BadRequestException("You cannot start a chat with yourself");
        }

        // Verify seller exists and is indeed a seller or admin
        const seller = await this.prismaService.baseUser.findUnique({
            where: { id: sellerId },
        });
        if (!seller) {
            throw new NotFoundException("Seller user not found");
        }

        const existing = await this.prismaService.chatRoom.findFirst({
            where: {
                buyerId,
                sellerId,
            },
        });

        if (existing) {
            return existing;
        }

        return this.prismaService.chatRoom.create({
            data: {
                buyerId,
                sellerId,
            },
        });
    }

    async getUserRooms(userId: number) {
        const rooms = await this.prismaService.chatRoom.findMany({
            where: {
                OR: [
                    { buyerId: userId },
                    { sellerId: userId },
                ],
            },
            include: {
                buyer: {
                    select: {
                        id: true,
                        email: true,
                        profile: { select: { full_name: true, avatar_url: true } },
                    },
                },
                seller: {
                    select: {
                        id: true,
                        email: true,
                        profile: { select: { full_name: true, avatar_url: true } },
                    },
                },
                messages: {
                    orderBy: { createdAt: "desc" },
                    take: 1,
                },
            },
            orderBy: {
                updatedAt: "desc",
            },
        });

        return rooms.map((room) => {
            const partner = room.buyerId === userId ? room.seller : room.buyer;
            const lastMessage = room.messages[0] || null;
            return {
                id: room.id,
                partner,
                lastMessage,
                createdAt: room.createdAt,
                updatedAt: room.updatedAt,
            };
        });
    }

    async getRoomMessages(roomId: number, userId: number, query: MessagesQueryDto) {
        const room = await this.prismaService.chatRoom.findUnique({
            where: { id: roomId },
        });

        if (!room) {
            throw new NotFoundException(`Chat room with ID ${roomId} not found`);
        }

        if (room.buyerId !== userId && room.sellerId !== userId) {
            throw new ForbiddenException("You are not a participant of this chat room");
        }

        const { page = 1, limit = 20 } = query;
        const skip = (page - 1) * limit;

        const [data, total] = await Promise.all([
            this.prismaService.chatMessage.findMany({
                where: { chatRoomId: roomId },
                skip,
                take: limit,
                orderBy: {
                    createdAt: "desc",
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
            throw new NotFoundException(`Chat room with ID ${dto.chatRoomId} not found`);
        }

        if (room.buyerId !== senderId && room.sellerId !== senderId) {
            throw new ForbiddenException("You are not a participant of this chat room");
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
                data: { updatedAt: new Date() },
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
            throw new ForbiddenException("You are not a participant of this chat room");
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

        return { message: "Messages marked as read" };
    }
}
