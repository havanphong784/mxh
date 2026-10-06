import {IsIn, IsOptional, IsString, MaxLength} from 'class-validator';

export class UpdatePostDto {
    @IsOptional()
    @IsString()
    @MaxLength(2000, { message: 'Nội dung bài viết không được vượt quá 2000 ký tự' })
    content?: string;

    @IsOptional()
    @IsString()
    @IsIn(['PUBLIC', 'FOLLOWERS', 'PRIVATE'], {
        message: 'visibility phải là PUBLIC, FOLLOWERS hoặc PRIVATE',
    })
    visibility?: 'PUBLIC' | 'FOLLOWERS' | 'PRIVATE';
}