import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type {FastifyReply, FastifyRequest} from 'fastify';
import {AuthService} from './auth.service.js';
import {RegisterDto} from './dto/register.dto.js';
import {VerifyOtpDto} from './dto/verify-otp.dto.js';
import {ResendOtpDto} from "./dto/resend-otp.dto.js";
import {LoginDto} from "./dto/login.dto.js";
import {JwtAuthGuard} from "./guards/jwt-auth.guard.js";
import {CurrentUser} from "./decorators/current-user.decorator.js";
import {ForgotPasswordDto} from "./dto/forgot-password.dto.js";
import {ResetPasswordDto} from "./dto/reset-password.dto.js";

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getMe(@CurrentUser('sub') userId: string) {
    return this.authService.getMe(userId);
  }

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

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
      @Req() req: FastifyRequest,
      @Res({ passthrough: true }) res: FastifyReply
  ) {
    const refreshToken = req.cookies.refreshToken;
    const result = await this.authService.logout(refreshToken);
    this.clearRefreshTokenCookie(res);
    return result;
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

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  private clearRefreshTokenCookie(res: FastifyReply) {
    res.clearCookie('refreshToken', {
      path: '/api/v1/auth',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });
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