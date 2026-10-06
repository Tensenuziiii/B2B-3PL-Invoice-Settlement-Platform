import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tenantStorage } from "./tenant.context";

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const user = req.user;

    if (user?.orgId && user?.sub) {
      tenantStorage.enterWith({
        organizationId: user.orgId,
        userId: user.sub,
      });
    }

    return next.handle();
  }
}
