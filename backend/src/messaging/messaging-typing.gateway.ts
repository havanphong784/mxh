import type { OnGatewayDisconnect } from "@nestjs/websockets";
import { SubscribeMessage, WebSocketGateway } from "@nestjs/websockets";
import { plainToInstance } from "class-transformer";
import { validateSync } from "class-validator";
import type { Socket } from "socket.io";
import { AccessSessionService } from "../auth/access-session.service.js";
import { MESSAGE_EVENTS } from "../events/event-types.js";
import { EventsGateway } from "../gateway/events.gateway.js";
import { TypingDto } from "./dto/typing.dto.js";
import { MessagingService } from "./messaging.service.js";

type SocketLimit = { events: number[]; starts: Map<string, number>; pending: Promise<void> };

@WebSocketGateway({ namespace: "/" })
export class MessagingTypingGateway implements OnGatewayDisconnect {
  private readonly limits = new WeakMap<Socket, SocketLimit>();

  constructor(
    private readonly messaging: MessagingService,
    private readonly events: EventsGateway,
    private readonly sessions: AccessSessionService,
  ) {}

  @SubscribeMessage(MESSAGE_EVENTS.TYPING)
  async handleTyping(client: Socket, input: unknown): Promise<void> {
    if (
      !client.connected ||
      typeof client.data.userId !== "string" ||
      typeof client.data.sessionId !== "string"
    )
      return;
    if (!input || typeof input !== "object" || Array.isArray(input)) return;
    const payload = plainToInstance(TypingDto, input);
    if (validateSync(payload, { whitelist: true, forbidNonWhitelisted: true }).length) return;

    const now = Date.now();
    const state = this.limits.get(client) ?? {
      events: [],
      starts: new Map<string, number>(),
      pending: Promise.resolve(),
    };
    this.limits.set(client, state);
    state.events = state.events.filter((time) => time > now - 10000);
    for (const [id, time] of state.starts) if (time <= now - 10000) state.starts.delete(id);
    if (state.events.length >= 30) return;
    state.events.push(now);
    const last = state.starts.get(payload.conversationId);
    if (payload.isTyping && last !== undefined && now - last < 2000) return;
    if (payload.isTyping) state.starts.set(payload.conversationId, now);

    // Serialize accepted events so a slow authorization cannot deliver start after stop.
    const relay = async () => {
      if (!client.connected) return;
      try {
        const header = client.handshake.auth?.token || client.handshake.headers?.authorization;
        if (typeof header !== "string") throw new Error("Missing socket credentials");
        const token = header.startsWith("Bearer ") ? header.slice(7) : header;
        const session = await this.sessions.verifyAccessToken(token);
        if (session.sub !== client.data.userId || session.sessionId !== client.data.sessionId)
          throw new Error("Socket session mismatch");
      } catch {
        client.disconnect(true);
        return;
      }
      try {
        const recipient = await this.messaging.getTypingRecipient(
          client.data.userId,
          payload.conversationId,
        );
        if (!client.connected) return;
        this.events.pushToUser(recipient, MESSAGE_EVENTS.TYPING, {
          conversationId: payload.conversationId,
          isTyping: payload.isTyping,
          userId: client.data.userId,
          streamId: client.id,
        });
      } catch {
        // Invalid membership is ignored; typing must not create an unhandled socket error.
      }
    };
    state.pending = state.pending.then(relay);
    await state.pending;
  }

  handleDisconnect(client: Socket): void {
    this.limits.delete(client);
  }
}
