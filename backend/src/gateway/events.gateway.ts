import {OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway, WebSocketServer,} from '@nestjs/websockets';
import {Server, Socket} from 'socket.io';
import {Logger} from '@nestjs/common';
import {OnEvent} from '@nestjs/event-emitter';
import {AccessSessionService} from '../auth/access-session.service.js';
import {AUTH_EVENTS} from '../events/event-types.js';
import type {SessionRevokedEvent, UserSessionsRevokedEvent} from '../events/event-types.js';

@WebSocketGateway({
    cors: {
        origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
        credentials: true,
    },
    namespace: '/',
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
    public readonly onlineUsers = new Map<string, Set<string>>();
    @WebSocketServer()
    private server!: Server;
    private readonly logger = new Logger(EventsGateway.name);

    constructor(private readonly accessSessionService: AccessSessionService) {}

    async handleConnection(client: Socket) {
        try {
            const authHeader =
                client.handshake.auth?.token || client.handshake.headers?.authorization;

            if (!authHeader || typeof authHeader !== 'string') {
                this.logger.warn(`Client ${client.id} bị từ chối: Không có auth token`);
                client.disconnect();
                return;
            }

            const token = authHeader.startsWith('Bearer ')
                ? authHeader.slice(7)
                : authHeader;

            const payload = await this.accessSessionService.verifyAccessToken(token);

            const userId: string = payload.sub;
            client.data.userId = userId;
            client.data.sessionId = payload.sessionId;

            await client.join(`user:${userId}`);

            if (!this.onlineUsers.has(userId)) {
                this.onlineUsers.set(userId, new Set());
            }
            this.onlineUsers.get(userId)!.add(client.id);

            this.logger.log(`User ${userId} đã kết nối WebSocket (Socket ID: ${client.id})`);
        } catch (error) {
            this.logger.warn(`Xác thực WebSocket thất bại cho socket ${client.id}`);
            client.disconnect();
        }
    }

    handleDisconnect(client: Socket) {
        const userId: string | undefined = client.data.userId;
        if (userId && this.onlineUsers.has(userId)) {
            const sockets = this.onlineUsers.get(userId)!;
            sockets.delete(client.id);
            if (sockets.size === 0) {
                this.onlineUsers.delete(userId);
            }
        }
        this.logger.log(`Socket ${client.id} đã ngắt kết nối`);
    }

    pushToUser(userId: string, event: string, data: any) {
        this.server.to(`user:${userId}`).emit(event, data);
    }

    isUserOnline(userId: string): boolean {
        return this.onlineUsers.has(userId);
    }

    @OnEvent(AUTH_EVENTS.SESSION_REVOKED)
    handleSessionRevoked(event: SessionRevokedEvent) {
        for (const socket of this.server.sockets.sockets.values()) {
            if (socket.data.sessionId === event.sessionId) {
                socket.disconnect(true);
            }
        }
    }

    @OnEvent(AUTH_EVENTS.USER_SESSIONS_REVOKED)
    handleUserSessionsRevoked(event: UserSessionsRevokedEvent) {
        for (const socket of this.server.sockets.sockets.values()) {
            if (
                socket.data.userId === event.userId &&
                socket.data.sessionId !== event.exceptSessionId
            ) {
                socket.disconnect(true);
            }
        }
    }
}
