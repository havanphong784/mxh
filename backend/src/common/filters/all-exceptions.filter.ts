import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";
import { ERROR_CODES } from "../exceptions/domain.exception.js";

interface ExceptionResponseObject {
  message?: string | string[];
  error?: string;
  code?: string;
  errors?: string[];
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: string = ERROR_CODES.INTERNAL_SERVER_ERROR;
    let message = "Đã có lỗi xảy ra từ máy chủ";
    let errors: string[] | null = null;

    const requestId =
      (request.id as string) ||
      (request.headers["x-request-id"] as string) ||
      "unknown";

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      code = this.mapStatusToErrorCode(statusCode);

      if (typeof exceptionResponse === "string") {
        message = exceptionResponse;
      } else if (
        typeof exceptionResponse === "object" &&
        exceptionResponse !== null
      ) {
        const resObj = exceptionResponse as ExceptionResponseObject;

        if (typeof resObj.code === "string") {
          code = resObj.code;
        } else if (
          typeof resObj.error === "string" &&
          resObj.error.length > 0
        ) {
          code = resObj.error;
        }

        if (Array.isArray(resObj.message)) {
          message = "Dữ liệu không hợp lệ";
          code = ERROR_CODES.VALIDATION_FAILED;
          errors = resObj.message;
        } else if (typeof resObj.message === "string") {
          message = resObj.message;
        }

        if (Array.isArray(resObj.errors)) {
          errors = resObj.errors;
        }
      }
    } else if (exception instanceof Error) {
      this.logger.error(
        `[500 Internal Error] [reqId: ${requestId}] ${request.method} ${request.url}`,
        exception.stack,
      );
      message = "Lỗi hệ thống không xác định. Vui lòng thử lại sau.";
    }

    response.header("x-request-id", requestId);

    response.status(statusCode).send({
      success: false,
      statusCode,
      code,
      message,
      errors,
      requestId,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }

  private mapStatusToErrorCode(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return ERROR_CODES.VALIDATION_FAILED;
      case HttpStatus.UNAUTHORIZED:
        return ERROR_CODES.AUTH_UNAUTHORIZED;
      case HttpStatus.FORBIDDEN:
        return ERROR_CODES.FORBIDDEN_ACTION;
      case HttpStatus.NOT_FOUND:
        return ERROR_CODES.POST_NOT_FOUND;
      case HttpStatus.TOO_MANY_REQUESTS:
        return ERROR_CODES.RATE_LIMIT_EXCEEDED;
      default:
        return ERROR_CODES.INTERNAL_SERVER_ERROR;
    }
  }
}
