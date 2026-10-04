import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { randomUUID } from 'crypto';

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const requestId = req.headers['x-request-id'] ?? randomUUID();
    req.headers['x-request-id'] = requestId;
    req.requestId = requestId;

    const res = context.switchToHttp().getResponse();
    res.setHeader('x-request-id', requestId);

    return next.handle();
  }
}
