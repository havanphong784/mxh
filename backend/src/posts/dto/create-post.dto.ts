import {
    ArrayMaxSize,
    IsArray,
    IsIn,
    IsInt,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    MaxLength,
    Min,
    ValidateNested
} from "class-validator";
import {Type} from "class-transformer";

export class PostMediaItemDto {
    @IsString()
    @IsNotEmpty({message: 'Public id của media không được để trống'})
    publicId!: string;

    @IsString()
    @IsNotEmpty({message: 'version không được để trống'})
    version!: string;

    @IsString()
    @IsNotEmpty({ message: 'signature không được để trống' })
    signature!: string;

    @IsString()
    @IsIn(['IMAGE', 'VIDEO', 'AUDIO'], {
        message: 'type phải là IMAGE, VIDEO hoặc AUDIO',
    })
    type!: 'IMAGE' | 'VIDEO' | 'AUDIO';

    @IsOptional()
    @IsInt()
    width?: number;

    @IsOptional()
    @IsInt()
    height?: number;

    @IsOptional()
    @IsNumber()
    duration?: number;

    @IsInt()
    @Min(0)
    order!: number;
}

export class CreatePostDto {
    @IsOptional()
    @IsString()
    @MaxLength(2000, {message: 'Nội dung bài viết không được vượt quá 2000 ký tự'})
    content?: string;

    @IsOptional()
    @IsString()
    @IsIn(['PUBLIC','FOLLOWERS', 'PRIVATE'], {message: "Chỉ chấp nhận các giá trị: PUBLIC, FOLLOWERS, PRIVATE"})
    visibility?: 'PUBLIC' | 'FOLLOWERS' | 'PRIVATE' = 'PUBLIC';

    @IsOptional()
    @IsArray()
    @ArrayMaxSize(10, { message: 'Mỗi bài viết chỉ được đính kèm tối đa 10 media' })
    @ValidateNested({ each: true })
    @Type(() => PostMediaItemDto)
    media?: PostMediaItemDto[];

    @IsOptional()
    @IsString()
    parentId?: string;
}