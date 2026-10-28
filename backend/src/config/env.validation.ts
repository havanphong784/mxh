import Joi from "joi";

export interface EnvironmentVariables {
  NODE_ENV?: "development" | "production" | "test";
  PORT: number;
  DATABASE_URL: string;
  CORS_ORIGIN: string;
  JWT_ACCESS_SECRET: string;
  JWT_ACCESS_EXPIRES_IN: string;
  JWT_REFRESH_SECRET: string;
  JWT_REFRESH_EXPIRES_IN: string;
  COOKIE_SECRET: string;
  SMTP_HOST: "mailhog" | "smtp.gmail.com";
  SMTP_PORT: number;
  SMTP_SECURE: boolean;
  SMTP_USER: string;
  SMTP_PASS: string;
  EMAIL_FROM: string;
  CLOUDINARY_CLOUD_NAME: string;
  CLOUDINARY_API_KEY: string;
  CLOUDINARY_API_SECRET: string;
}

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid("development", "production", "test")
    .default("development"),
  PORT: Joi.number().default(5000),
  DATABASE_URL: Joi.string().required(),
  CORS_ORIGIN: Joi.string().default("http://localhost:3000"),
  JWT_ACCESS_SECRET: Joi.string().required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default("15m"),
  JWT_REFRESH_SECRET: Joi.string().required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default("7d"),
  COOKIE_SECRET: Joi.string().required(),
  SMTP_HOST: Joi.string().valid("mailhog", "smtp.gmail.com"),
  SMTP_PORT: Joi.number().integer().valid(1025, 587, 465),
  SMTP_SECURE: Joi.boolean().required(),
  SMTP_USER: Joi.string().required().email(),
  SMTP_PASS: Joi.string().required(),
  EMAIL_FROM: Joi.string().required(),
  CLOUDINARY_CLOUD_NAME: Joi.string().required(),
  CLOUDINARY_API_KEY: Joi.string().required(),
  CLOUDINARY_API_SECRET: Joi.string().required(),
});
