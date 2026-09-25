import {Injectable, Logger} from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
    private readonly logger = new Logger(MailService.name);
    private transporter: nodemailer.Transporter;

    constructor() {
        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: Number(process.env.SMTP_PORT) || 465,
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });
    }

    async sendOtpEmail(toEmail: string, otpCode: string): Promise<boolean> {
        const from = process.env.EMAIL_FROM || 'no-reply@mxh.local';
        const subject = 'Mã xác thực tài khoản Mạng Xã Hội';
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                <h2 style="color: #2563eb; text-align: center;">Chào mừng bạn đến với Mạng Xã Hội!</h2>
                <p>Cảm ơn bạn đã đăng ký tài khoản. Để hoàn tất kích hoạt, vui lòng nhập mã OTP dưới đây:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #1e293b; background-color: #f1f5f9; padding: 12px 24px; border-radius: 6px; border: 1px dashed #cbd5e1;">
                        ${otpCode}
                    </span>
                </div>
                <p style="color: #64748b; font-size: 14px;">Mã OTP có hiệu lực trong vòng <strong>5 phút</strong>. Vui lòng không chia sẻ mã này cho bất kỳ ai.</p>
                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
                <p style="color: #94a3b8; font-size: 12px; text-align: center;">Nếu bạn không yêu cầu đăng ký tài khoản này, vui lòng bỏ qua email.</p>
            </div>
        `;

        try {
            if (!process.env.SMTP_USER || process.env.SMTP_USER.includes('your-email')) {
                this.logger.warn(`⚠️ SMTP chưa cấu hình tài khoản thật. MÃ OTP TEST cho [${toEmail}] LÀ: 👉 ${otpCode} 👈`);
                return true;
            }

            await this.transporter.sendMail({
                from,
                to: toEmail,
                subject,
                html,
            });
            this.logger.log(`✅ Đã gửi email OTP thành công tới: ${toEmail}`);
            return true;
        } catch (error) {
            this.logger.error(`❌ Gửi email OTP tới ${toEmail} thất bại:`, error);
            this.logger.warn(`👉 MÃ OTP BACKUP: ${otpCode}`);
            return false;
        }
    }

    async sendResetPasswordEmail(toEmail: string, otpCode: string): Promise<boolean> {
        const from = process.env.EMAIL_FROM || 'no-reply@mxh.local';
        const subject = 'Yêu cầu đặt lại mật khẩu - Mạng Xã Hội';
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                <h2 style="color: #dc2626; text-align: center;">Yêu cầu đặt lại mật khẩu</h2>
                <p>Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản liên kết với email này.</p>
                <p>Vui lòng nhập mã OTP dưới đây để hoàn tất việc đổi mật khẩu:</p>
                <div style="text-align: center; margin: 30px 0;">
                    <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #1e293b; background-color: #fef2f2; padding: 12px 24px; border-radius: 6px; border: 1px dashed #fca5a5;">
                        ${otpCode}
                    </span>
                </div>
                <p style="color: #64748b; font-size: 14px;">Mã OTP có hiệu lực trong vòng <strong>5 phút</strong>. Tuyệt đối không cung cấp mã này cho người khác.</p>
                <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
                <p style="color: #94a3b8; font-size: 12px; text-align: center;">Nếu bạn không thực hiện yêu cầu này, vui lòng đổi mật khẩu ngay hoặc liên hệ quản trị viên.</p>
            </div>
        `;

        try {
            if (!process.env.SMTP_USER || process.env.SMTP_USER.includes('your-email')) {
                this.logger.warn(`⚠️ SMTP chưa cấu hình tài khoản thật. MÃ OTP RESET CHO [${toEmail}] LÀ: 👉 ${otpCode} 👈`);
                return true;
            }

            await this.transporter.sendMail({
                from,
                to: toEmail,
                subject,
                html,
            });
            this.logger.log(`✅ Đã gửi email Reset Password thành công tới: ${toEmail}`);
            return true;
        } catch (error) {
            this.logger.error(`❌ Gửi email Reset Password tới ${toEmail} thất bại:`, error);
            this.logger.warn(`👉 MÃ OTP BACKUP: ${otpCode}`);
            return false;
        }
    }
}