import {IsEmail, IsNotEmpty, Length, MaxLength} from 'class-validator';
import {Transform} from 'class-transformer';

export class ResetPasswordDto {
    @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
    @IsNotEmpty({ message: 'Email không được để trống' })
    @IsEmail({}, { message: 'Email không đúng định dạng' })
    @MaxLength(255, { message: 'Email không được vượt quá 255 ký tự' })
    email!: string;

    @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
    @IsNotEmpty({ message: 'Mã OTP không được để trống' })
    @Length(6, 6, { message: 'Mã OTP phải có đúng 6 chữ số' })
    code!: string;

    @IsNotEmpty({ message: 'Mật khẩu mới không được để trống' })
    @Length(6, 100, { message: 'Mật khẩu mới phải từ 6 đến 100 ký tự' })
    newPassword!: string;
}