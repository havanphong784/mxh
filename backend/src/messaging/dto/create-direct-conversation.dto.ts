import { IsNotEmpty, IsString } from "class-validator";

export class CreateDirectConversationDto {
  @IsString()
  @IsNotEmpty({ message: "Người nhận không được để trống" })
  targetUserId!: string;
}
