import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { MessageMediaInputDto } from "./message-media.dto.js";

export class SendMessageDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: "Tin nhắn không được vượt quá 2000 ký tự" })
  body?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => MessageMediaInputDto)
  media?: MessageMediaInputDto[];

  @IsString()
  @IsNotEmpty({ message: "clientMessageId không được để trống" })
  @MaxLength(128, { message: "clientMessageId không được vượt quá 128 ký tự" })
  clientMessageId!: string;
}
