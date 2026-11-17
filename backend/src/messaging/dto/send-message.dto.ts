import { IsNotEmpty, IsString, MaxLength } from "class-validator";

export class SendMessageDto {
  @IsString()
  @IsNotEmpty({ message: "Tin nhắn không được để trống" })
  @MaxLength(2000, { message: "Tin nhắn không được vượt quá 2000 ký tự" })
  body!: string;

  @IsString()
  @IsNotEmpty({ message: "clientMessageId không được để trống" })
  @MaxLength(128, { message: "clientMessageId không được vượt quá 128 ký tự" })
  clientMessageId!: string;
}
