import {IsEmail, IsNotEmpty, MaxLength} from 'class-validator';
import {Transform} from 'class-transformer';

export class ForgotPasswordDto {
    @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
    @IsNotEmpty({ message: 'Email không được để trống' })
    @IsEmail({}, { message: 'Email không đúng định dạng' })
    @MaxLength(255, { message: 'Email không được vượt quá 255 ký tự' })
    email!: string;
}