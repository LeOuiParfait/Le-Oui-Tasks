import { User, UserRole } from '../types';

const MANAGER_ROLES: UserRole[] = ['super_admin', 'admin', 'manager', 'team_lead'];
const ADMIN_ROLES: UserRole[] = ['super_admin', 'admin'];

export function canCreateProject(user: User): boolean {
  return MANAGER_ROLES.includes(user.role);
}

export function canEditProject(user: User): boolean {
  return MANAGER_ROLES.includes(user.role);
}

export function canDeleteProject(user: User): boolean {
  return ADMIN_ROLES.includes(user.role);
}

export function canCreateTask(user: User): boolean {
  return MANAGER_ROLES.includes(user.role);
}

export function canAssignTask(user: User): boolean {
  return MANAGER_ROLES.includes(user.role);
}

export function canDeleteTask(user: User): boolean {
  return MANAGER_ROLES.includes(user.role);
}

export function canApproveTask(user: User): boolean {
  return MANAGER_ROLES.includes(user.role);
}

export function canCreateTeam(user: User): boolean {
  return MANAGER_ROLES.includes(user.role);
}

export function canManageTeamMembers(user: User, teamManagerId?: string): boolean {
  if (ADMIN_ROLES.includes(user.role)) return true;
  if (user.role === 'manager' || user.role === 'team_lead') {
    return !teamManagerId || teamManagerId === user.id || ADMIN_ROLES.includes(user.role);
  }
  return false;
}

export function canDeleteTeam(user: User): boolean {
  return ADMIN_ROLES.includes(user.role);
}

export function canInviteMembers(user: User): boolean {
  return ADMIN_ROLES.includes(user.role);
}

export function canChangeRoles(user: User): boolean {
  return ADMIN_ROLES.includes(user.role);
}

export function canCreateObjective(user: User): boolean {
  return MANAGER_ROLES.includes(user.role);
}

export function canDeleteObjective(user: User): boolean {
  return MANAGER_ROLES.includes(user.role);
}

export function canGenerateReport(user: User): boolean {
  return MANAGER_ROLES.includes(user.role);
}

export function canViewAllAttendance(user: User): boolean {
  return MANAGER_ROLES.includes(user.role);
}

export function canEditOrgSettings(user: User): boolean {
  return ADMIN_ROLES.includes(user.role);
}
