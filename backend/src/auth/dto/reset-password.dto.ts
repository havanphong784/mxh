import { IsEmail, IsNotEmpty, IsString, IsStrongPassword, Length, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

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

    @IsString()
    @IsNotEmpty({ message: 'Mật khẩu mới không được để trống' })
    @MaxLength(100, { message: 'Mật khẩu mới không được vượt quá 100 ký tự' })
    @IsStrongPassword(
        {
            minLength: 8,
            minLowercase: 1,
            minUppercase: 1,
            minNumbers: 1,
            minSymbols: 0,
        },
        {
            message: 'Mật khẩu mới phải có ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường và chữ số',
        }
    )
    newPassword!: string;
}