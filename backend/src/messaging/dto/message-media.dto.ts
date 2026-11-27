import { IsInt, IsNotEmpty, IsString, MaxLength, Min } from "class-validator";

export class MessageMediaInputDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  publicId!: string;

  @IsInt()
  @Min(1)
  version!: number;

  @IsString()
  @MaxLength(128)
  signature!: string;
}
