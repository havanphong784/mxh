import {CanActivate, ExecutionContext, Injectable, UnauthorizedException,} from '@nestjs/common';
import type {FastifyRequest} from 'fastify';
import {AccessSessionService} from '../access-session.service.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
    constructor(private readonly accessSessionService: AccessSessionService) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<FastifyRequest>();
        const authHeader = request.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new UnauthorizedException('Thiếu hoặc sai định dạng Token xác thực');
        }

        const token = authHeader.split(' ')[1];

        (request as any).user = await this.accessSessionService.verifyAccessToken(token);
        return true;
    }
}
