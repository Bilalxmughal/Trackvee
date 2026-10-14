import { SetMetadata } from '@nestjs/common';
import { ROLES_KEY } from '../guards/roles.guard.js';
import type { UserRole } from '@yotrack/types';

export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
