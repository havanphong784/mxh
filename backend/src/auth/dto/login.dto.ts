import {IsEmail, IsNotEmpty, IsString, Length, MaxLength} from 'class-validator';
import {Transform} from 'class-transformer';

export class LoginDto {
    @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
    @IsEmail({}, { message: 'Email không đúng định dạng' })
    @MaxLength(255, { message: 'Email không được vượt quá 255 ký tự' })
    @IsNotEmpty({ message: 'Email không được để trống' })
    email!: string;

    @IsString()
    @Length(6, 100, { message: 'Mật khẩu phải từ 6 đến 100 ký tự' })
    @IsNotEmpty({ message: 'Mật khẩu không được để trống' })
    password!: string;
}