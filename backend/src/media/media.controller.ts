import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { MediaService } from "./media.service.js";
import { UploadSignatureQueryDto } from "./dto/upload-signature-query.dto.js";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { Throttle } from "@nestjs/throttler";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";

export interface UploadSignatureResponseDto {
  signature: string;
  timestamp: number;
  apiKey: string | undefined;
  cloudName: string | undefined;
  folder: string;
  resourceType: string;
}

@Controller("media")
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Get("upload-signature")
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 25, ttl: 60000 } })
  getUploadSignature(
    @CurrentUser("sub") userId: string,
    @Query() query: UploadSignatureQueryDto,
  ): UploadSignatureResponseDto {
    return this.mediaService.generateUploadSignature(
      query.folder,
      userId,
      query.mediaType,
    );
  }
}
