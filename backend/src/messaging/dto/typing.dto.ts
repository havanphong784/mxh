import { IsBoolean, IsNotEmpty, IsString, MaxLength } from "class-validator";

export class TypingDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  conversationId!: string;

  @IsBoolean()
  isTyping!: boolean;
}
