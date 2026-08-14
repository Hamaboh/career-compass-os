import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { RequestContext } from '../context/request-context';

/** AuthGuardがrequestに付与した認証済み社員のコンテキストをcontrollerで受け取る。 */
export const CurrentEmployee = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestContext => {
    const request = ctx.switchToHttp().getRequest<{ employeeContext?: RequestContext }>();
    if (!request.employeeContext) {
      throw new Error('CurrentEmployee decorator used on a route without AuthGuard context');
    }
    return request.employeeContext;
  },
);
