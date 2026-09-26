import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { MediaService } from './media.service.js';
import { UploadSignatureQueryDto } from './dto/upload-signature-query.dto.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { Throttle } from '@nestjs/throttler';

@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Get('upload-signature')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  getUploadSignature(@Query() query: UploadSignatureQueryDto) {
    return this.mediaService.generateUploadSignature(query.folder);
  }
}
