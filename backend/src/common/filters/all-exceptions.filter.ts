import {ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger,} from "@nestjs/common";
import type {FastifyReply, FastifyRequest} from "fastify";

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = "Đã có lỗi xảy ra từ máy chủ";
    let errors: any = null;

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === "string") {
        message = exceptionResponse;
      } else if (
        typeof exceptionResponse === "object" &&
        exceptionResponse !== null
      ) {
        const resObj = exceptionResponse as Record<string, any>;

        if (Array.isArray(resObj.message)) {
          message = "Dữ liệu không hợp lệ";
          errors = resObj.message;
        } else {
          message = resObj.message || exception.message;
          errors = resObj.error || null;
        }
      }
    } else if (exception instanceof Error) {
      this.logger.error(
        `[500 Internal Error] ${request.method} ${request.url}`,
        exception.stack,
      );
      message = "Lỗi hệ thống không xác định. Vui lòng thử lại sau.";
    }

    response.status(statusCode).send({
      success: false,
      statusCode,
      message,
      errors,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
