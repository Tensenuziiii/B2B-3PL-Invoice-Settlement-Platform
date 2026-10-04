import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    const requestId = req.headers['x-request-id'] ?? 'n/a';

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const response =
      exception instanceof HttpException
        ? exception.getResponse()
        : { message: 'Internal server error' };

    const payload = {
      code: status,
      message:
        typeof response === 'object' && response !== null && 'message' in response
          ? (response.message as string)
          : 'Unexpected error',
      details:
        typeof response === 'object' && response !== null && 'details' in response
          ? response.details
          : undefined,
      requestId,
    };

    this.logger.error(
      `${req.method} ${req.url} failed`,
      exception instanceof Error ? exception.stack : undefined,
    );

    res.status(status).json(payload);
  }
}
