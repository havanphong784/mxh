import {Injectable} from "@nestjs/common";
import {PrismaService} from "./prisma/prisma.service.js";
import {EventEmitter2} from "@nestjs/event-emitter";

@Injectable()
export class AppService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  getHealthCheck() {
    return {
      status: "ok",
      message: "Backend with NestJS & Fastify is running!",
      timestamp: new Date().toISOString(),
    };
  }
}
