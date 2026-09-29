import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUrl, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1, { message: 'Tên hiển thị phải có ít nhất 1 ký tự' })
  @MaxLength(50, { message: 'Tên hiển thị tối đa 50 ký tự' })
  displayName?: string;

  @IsOptional()
  @ValidateIf((_, val) => val !== null)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(250, { message: 'Tiểu sử tối đa 250 ký tự' })
  bio?: string | null;

  @IsOptional()
  @ValidateIf((_, val) => val !== null)
  @IsUrl({}, { message: 'Đường dẫn avatar không hợp lệ' })
  avatarUrl?: string | null;

  @IsOptional()
  @ValidateIf((_, val) => val !== null)
  @IsString()
  avatarPublicId?: string | null;

  @IsOptional()
  @ValidateIf((_, val) => val !== null)
  @IsUrl({}, { message: 'Đường dẫn banner không hợp lệ' })
  bannerUrl?: string | null;

  @IsOptional()
  @ValidateIf((_, val) => val !== null)
  @IsString()
  bannerPublicId?: string | null;
}
