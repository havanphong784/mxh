import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import {AccessSessionService} from '../access-session.service.js';

@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  constructor(private readonly accessSessionService: AccessSessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const authHeader = request.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        (request as any).user = await this.accessSessionService.verifyAccessToken(token);
      } catch {
        // Token không hợp lệ thì coi như khách vãng lai, không chặn request
      }
    }

    return true;
  }
}
