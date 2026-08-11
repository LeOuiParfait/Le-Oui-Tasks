import { User, UserRole, Project, ProjectMember } from '../types';

const ADMIN_ROLES: UserRole[] = ['super_admin'];

export function canCreateProject(user: User): boolean {
  return user.role === 'super_admin';
}

export function canEditProject(user: User, project?: Project): boolean {
  if (user.role === 'super_admin') return true;
  if (!project) return false;
  // Owner or member with 'owner' role can edit
  return project.ownerId === user.id || 
         project.members.some(m => m.userId === user.id && m.role === 'owner');
}

export function canDeleteProject(user: User): boolean {
  return user.role === 'super_admin';
}

export function canCreateTask(user: User, project?: Project): boolean {
  if (user.role === 'super_admin') return true;
  if (!project) return false;
  // Owner or members (not viewers) can create tasks
  return project.ownerId === user.id || 
         project.members.some(m => m.userId === user.id && m.role !== 'viewer');
}

export function canAssignTask(user: User, project?: Project): boolean {
  if (user.role === 'super_admin') return true;
  if (!project) return false;
  // Owner or members with 'owner' role can assign
  return project.ownerId === user.id || 
         project.members.some(m => m.userId === user.id && m.role === 'owner');
}

export function canDeleteTask(user: User, project?: Project): boolean {
  if (user.role === 'super_admin') return true;
  if (!project) return false;
  return project.ownerId === user.id || 
         project.members.some(m => m.userId === user.id && m.role === 'owner');
}

export function canApproveTask(user: User, project?: Project): boolean {
  if (user.role === 'super_admin') return true;
  if (!project) return false;
  return project.ownerId === user.id || 
         project.members.some(m => m.userId === user.id && m.role === 'owner');
}

export function canCreateTeam(user: User): boolean {
  return user.role === 'super_admin';
}

export function canManageTeamMembers(user: User, teamManagerId?: string): boolean {
  return user.role === 'super_admin';
}

export function canDeleteTeam(user: User): boolean {
  return user.role === 'super_admin';
}

export function canInviteMembers(user: User): boolean {
  return user.role === 'super_admin';
}

export function canChangeRoles(user: User): boolean {
  return user.role === 'super_admin';
}

export function canCreateObjective(user: User): boolean {
  return user.role === 'super_admin';
}

export function canDeleteObjective(user: User): boolean {
  return user.role === 'super_admin';
}

export function canGenerateReport(user: User): boolean {
  return user.role === 'super_admin';
}

export function canViewAllAttendance(user: User): boolean {
  return user.role === 'super_admin';
}

export function canEditOrgSettings(user: User): boolean {
  return user.role === 'super_admin';
}
