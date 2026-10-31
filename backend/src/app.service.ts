import {Injectable} from "@nestjs/common";

@Injectable()
export class AppService {
  getHealthCheck() {
    return {
      status: "ok",
      message: "Backend with NestJS & Fastify is running!",
      timestamp: new Date().toISOString(),
    };
  }
}
