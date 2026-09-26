import { IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'Tên hiển thị phải có ít nhất 1 ký tự' })
  @MaxLength(50, { message: 'Tên hiển thị tối đa 50 ký tự' })
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(250, { message: 'Tiểu sử tối đa 250 ký tự' })
  bio?: string;

  @IsOptional()
  @IsUrl({}, { message: 'Đường dẫn avatar không hợp lệ' })
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  avatarPublicId?: string;

  @IsOptional()
  @IsUrl({}, { message: 'Đường dẫn banner không hợp lệ' })
  bannerUrl?: string;

  @IsOptional()
  @IsString()
  bannerPublicId?: string;
}
