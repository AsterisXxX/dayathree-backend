import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';

import {
  ROLES_KEY,
  STAFF_ROLES,
} from './roles.decorator';
import { RolesGuard } from './roles.guard';
import { SessionGuard } from './session.guard';
import { StaffRoles } from './staff-roles.decorator';

describe('StaffRoles decorator', () => {
  const reflector = new Reflector();

  it('attaches both guards in the correct order', () => {
    class TestController {
      @StaffRoles(STAFF_ROLES.RIDER)
      rider() {
        return true;
      }
    }

    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      TestController.prototype.rider,
    );

    expect(guards).toEqual([
      SessionGuard,
      RolesGuard,
    ]);
  });

  it('registers the required Rider role', () => {
    class TestController {
      @StaffRoles(STAFF_ROLES.RIDER)
      rider() {
        return true;
      }
    }

    const required = reflector.get(
      ROLES_KEY,
      TestController.prototype.rider,
    );

    expect(required).toEqual(['RIDER']);
  });

  it('registers the required Checker role', () => {
    class TestController {
      @StaffRoles(STAFF_ROLES.CHECKER)
      checker() {
        return true;
      }
    }

    const required = reflector.get(
      ROLES_KEY,
      TestController.prototype.checker,
    );

    expect(required).toEqual(['CHECKER']);
  });

  it('supports multiple permitted staff roles', () => {
    class TestController {
      @StaffRoles(
        STAFF_ROLES.RIDER,
        STAFF_ROLES.CHECKER,
      )
      shared() {
        return true;
      }
    }

    const required = reflector.get(
      ROLES_KEY,
      TestController.prototype.shared,
    );

    expect(required).toEqual(['RIDER', 'CHECKER']);
  });
});
