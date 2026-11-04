import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'dayathree:required_roles';

export const STAFF_ROLES = {
  RIDER: 'RIDER',
  CHECKER: 'CHECKER',
} as const;

export type StaffRole =
  (typeof STAFF_ROLES)[keyof typeof STAFF_ROLES];

export const Roles = (...roles: StaffRole[]) =>
  SetMetadata(ROLES_KEY, roles);
