import {
  applyDecorators,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';

import {
  Roles,
  StaffRole,
} from './roles.decorator';
import { RolesGuard } from './roles.guard';
import { SessionGuard } from './session.guard';

export function StaffRoles(
  ...roles: StaffRole[]
): MethodDecorator & ClassDecorator {
  return applyDecorators(
    Roles(...roles),
    UseGuards(SessionGuard, RolesGuard),
    ApiBearerAuth(),
  );
}
