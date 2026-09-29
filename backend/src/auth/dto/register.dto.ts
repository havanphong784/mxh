import { IsEmail, IsNotEmpty, IsString, IsStrongPassword, Length, Matches, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class RegisterDto {
    @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
    @IsEmail({}, { message: 'Email không đúng định dạng' })
    @MaxLength(255, { message: 'Email không được vượt quá 255 ký tự' })
    @IsNotEmpty({ message: 'Email không được để trống' })
    email!: string;

    @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
    @IsString()
    @Length(3, 30, { message: 'Username phải từ 3 đến 30 ký tự' })
    @Matches(/^[a-zA-Z0-9_]+$/, { message: 'Username chỉ được chứa chữ cái, số và dấu gạch dưới' })
    username!: string;

    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    @IsString()
    @Length(2, 80, { message: 'Tên hiển thị phải từ 2 đến 80 ký tự' })
    displayName!: string;

    @IsString()
    @IsNotEmpty({ message: 'Mật khẩu không được để trống' })
    @MaxLength(100, { message: 'Mật khẩu không được vượt quá 100 ký tự' })
    @IsStrongPassword(
        {
            minLength: 8,
            minLowercase: 1,
            minUppercase: 1,
            minNumbers: 1,
            minSymbols: 0,
        },
        {
            message: 'Mật khẩu phải có ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường và chữ số',
        }
    )
    password!: string;
}