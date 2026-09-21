import {IsEmail, IsNotEmpty, IsString, Length} from 'class-validator';

export class VerifyOtpDto {
    @IsEmail({}, { message: 'Email không đúng định dạng' })
    @IsNotEmpty({ message: 'Email không được để trống' })
    email!: string;

    @IsString()
    @Length(6, 6, { message: 'Mã OTP phải đúng 6 chữ số' })
    code!: string;
}
