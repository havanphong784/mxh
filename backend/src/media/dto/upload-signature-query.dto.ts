import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class UploadSignatureQueryDto {
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng chỉ định thư mục upload' })
  @IsIn(['avatars', 'banners', 'posts'], {
    message: 'Thư mục không hợp lệ. Chỉ chấp nhận: avatars, banners, posts',
  })
  folder!: 'avatars' | 'banners' | 'posts';
}
