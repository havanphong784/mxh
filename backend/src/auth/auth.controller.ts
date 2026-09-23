import {Body, Controller, HttpCode, HttpStatus, Post, Req, Res, UnauthorizedException,} from '@nestjs/common';
import type {FastifyReply, FastifyRequest} from 'fastify';
import {AuthService} from './auth.service.js';
import {RegisterDto} from './dto/register.dto.js';
import {VerifyOtpDto} from './dto/verify-otp.dto.js';
import {ResendOtpDto} from "./dto/resend-otp.dto.js";
import {LoginDto} from "./dto/login.dto.js";

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(
      @Body() dto: VerifyOtpDto,
      @Req() req: FastifyRequest,
      @Res({ passthrough: true }) res: FastifyReply
  ) {
    const meta = {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    };

    const result = await this.authService.verifyOtp(dto, meta);
    this.setRefreshTokenCookie(res, result.refreshToken);
    return {
      message: result.message,
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  @Post('resend-otp')
  @HttpCode(HttpStatus.OK)
  async resendOtp(@Body() dto: ResendOtpDto) {
    return this.authService.resendOtp(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
      @Body() dto: LoginDto,
      @Req() req: FastifyRequest,
      @Res({ passthrough: true }) res: FastifyReply
  ) {
    const meta = {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    };

    const result = await this.authService.login(dto, meta);
    this.setRefreshTokenCookie(res, result.refreshToken);

    return {
      message: result.message,
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
      @Req() req: FastifyRequest,
      @Res({ passthrough: true }) res: FastifyReply
  ) {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
      throw new UnauthorizedException('Không tìm thấy refresh token trong cookie');
    }

    const meta = {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    };

    const result = await this.authService.refreshTokens(refreshToken, meta);
    this.setRefreshTokenCookie(res, result.refreshToken);

    return {
      message: result.message,
      accessToken: result.accessToken,
    };
  }

  private setRefreshTokenCookie(res: FastifyReply, refreshToken: string) {
    res.setCookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Chỉ bật HTTPS khi lên Production
      sameSite: 'lax',    // Chống tấn công CSRF
      path: '/api/v1/auth',
      maxAge: 7 * 24 * 60 * 60,
    });
  }
}