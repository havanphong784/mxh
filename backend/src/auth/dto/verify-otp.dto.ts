import {IsEmail, IsNotEmpty, IsString, Length} from 'class-validator';
import {Transform} from "class-transformer";

export class VerifyOtpDto {
    @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
    @IsEmail({}, { message: 'Email không đúng định dạng' })
    @IsNotEmpty({ message: 'Email không được để trống' })
    email!: string;

    @IsString()
    @Length(6, 6, { message: 'Mã OTP phải đúng 6 chữ số' })
    code!: string;
}
