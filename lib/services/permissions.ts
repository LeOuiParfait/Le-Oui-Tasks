import { User, UserRole, Project, ProjectMember, Team } from '@/types';

// ============== RÔLES HELPERS ==============

const ADMIN_ROLES: UserRole[] = ['super_admin', 'admin'];
const MANAGEMENT_ROLES: UserRole[] = ['super_admin', 'admin', 'manager', 'team_lead'];

export function isAdmin(user: User): boolean {
  return ADMIN_ROLES.includes(user.role);
}

function isManagement(user: User): boolean {
  return MANAGEMENT_ROLES.includes(user.role);
}

function isSuperAdmin(user: User): boolean {
  return user.role === 'super_admin';
}

// ============== ORGANISATION ==============

export function canEditOrgSettings(user: User): boolean {
  return user.role === 'super_admin';
}

export function canViewOrgSettings(user: User): boolean {
  return isAdmin(user);
}

export function canInviteMembers(user: User): boolean {
  return user.role === 'super_admin' || user.role === 'admin' || user.role === 'manager';
}

export function canDeleteMembers(user: User): boolean {
  return isAdmin(user);
}

export function canChangeRoles(user: User, targetRole?: UserRole): boolean {
  if (user.role === 'super_admin') return true;
  if (user.role === 'admin') {
    // Admin ne peut pas créer de super_admin
    return targetRole !== 'super_admin';
  }
  return false;
}

// ============== ÉQUIPES ==============

export function canCreateTeam(user: User): boolean {
  return user.role === 'super_admin' || user.role === 'admin' || user.role === 'manager';
}

export function canEditTeam(user: User, team?: Team): boolean {
  if (isAdmin(user)) return true;
  if (!team) return false;
  // Manager de l'équipe
  if (user.role === 'manager' && team.managerId === user.id) return true;
  // Team lead de l'équipe
  if (user.role === 'team_lead' && team.managerId === user.id) return true;
  return false;
}

export function canDeleteTeam(user: User): boolean {
  return isAdmin(user);
}

export function canManageTeamMembers(user: User, team?: Team): boolean {
  if (isAdmin(user)) return true;
  if (!team) return false;
  // Manager ou team_lead de cette équipe
  return (user.role === 'manager' || user.role === 'team_lead') && team.managerId === user.id;
}

export function canViewAllTeams(user: User): boolean {
  return isAdmin(user);
}

export function canViewTeam(user: User, team: Team): boolean {
  if (isAdmin(user)) return true;
  // Manager ou membre de l'équipe
  return team.managerId === user.id || team.memberIds.includes(user.id);
}

// ============== PROJETS ==============

export function canCreateProject(user: User): boolean {
  return user.role === 'super_admin' || user.role === 'admin' || user.role === 'manager';
}

export function canViewAllProjects(user: User): boolean {
  return isAdmin(user);
}

export function canViewProject(user: User, project: Project): boolean {
  if (isAdmin(user)) return true;
  // Owner ou membre direct
  if (project.ownerId === user.id || project.memberIds.includes(user.id)) return true;
  // Appartenance via une équipe rattachée au projet
  if (user.teamIds?.length && project.teamIds?.length) {
    return project.teamIds.some(tid => user.teamIds!.includes(tid));
  }
  return false;
}

export function canEditProject(user: User, project?: Project): boolean {
  if (isAdmin(user)) return true;
  if (!project) return false;
  // Owner du projet ou membre avec rôle owner/lead
  return project.ownerId === user.id || 
         project.members.some(m => m.userId === user.id && (m.role === 'owner' || m.role === 'lead'));
}

export function canDeleteProject(user: User): boolean {
  return isAdmin(user);
}

export function canManageProjectMembers(user: User, project?: Project): boolean {
  if (isAdmin(user)) return true;
  if (!project) return false;
  // Owner ou lead du projet
  return project.ownerId === user.id || 
         project.members.some(m => m.userId === user.id && (m.role === 'owner' || m.role === 'lead'));
}

// ============== TÂCHES ==============

export function canViewAllTasks(user: User): boolean {
  return isAdmin(user);
}

export function canViewTask(user: User, taskProjectId: string, projects: Project[]): boolean {
  if (isAdmin(user)) return true;
  // Membre du projet de la tâche (ou via équipe)
  const project = projects.find(p => p.id === taskProjectId);
  return project ? canViewProject(user, project) : false;
}

export function canCreateTask(user: User, project?: Project): boolean {
  if (isAdmin(user)) return true;
  if (!project) return false;
  // Tous les membres sauf viewers peuvent créer des tâches
  if (user.role === 'viewer') return false;
  return project.memberIds.includes(user.id) && 
         !project.members.some(m => m.userId === user.id && m.role === 'viewer');
}

export function canAssignTask(user: User, project?: Project): boolean {
  if (isAdmin(user)) return true;
  if (!project) return false;
  // Owner, lead, ou manager/team_lead du projet
  if (user.role === 'manager' || user.role === 'team_lead') {
    return project.memberIds.includes(user.id);
  }
  return project.ownerId === user.id || 
         project.members.some(m => m.userId === user.id && (m.role === 'owner' || m.role === 'lead'));
}

export function canEditTask(user: User, taskAssigneeIds: string[], project?: Project): boolean {
  if (isAdmin(user)) return true;
  if (!project) return false;
  // Owner/lead du projet, ou assigné à la tâche
  if (taskAssigneeIds.includes(user.id)) return true;
  return project.ownerId === user.id || 
         project.members.some(m => m.userId === user.id && (m.role === 'owner' || m.role === 'lead'));
}

export function canDeleteTask(user: User, project?: Project): boolean {
  if (isAdmin(user)) return true;
  if (!project) return false;
  return project.ownerId === user.id || 
         project.members.some(m => m.userId === user.id && (m.role === 'owner' || m.role === 'lead'));
}

export function canApproveTask(user: User, project?: Project): boolean {
  if (isAdmin(user)) return true;
  if (!project) return false;
  // Owner, lead, manager, ou team_lead
  if (user.role === 'manager' || user.role === 'team_lead') {
    return project.memberIds.includes(user.id);
  }
  return project.ownerId === user.id || 
         project.members.some(m => m.userId === user.id && (m.role === 'owner' || m.role === 'lead'));
}

// ============== PRÉSENCES ==============

export function canViewAllAttendance(user: User): boolean {
  return isAdmin(user);
}

export function canViewTeamAttendance(user: User, teams: Team[]): boolean {
  if (isAdmin(user)) return true;
  // Manager ou team_lead de l'équipe
  return (user.role === 'manager' || user.role === 'team_lead') && 
         teams.some(t => t.managerId === user.id);
}

export function canViewProjectAttendance(user: User, projects: Project[]): boolean {
  if (isAdmin(user)) return true;
  // Manager/team_lead dans au moins un projet
  if (user.role === 'manager' || user.role === 'team_lead') {
    return projects.some(p => 
      p.ownerId === user.id || 
      p.members.some(m => m.userId === user.id && (m.role === 'owner' || m.role === 'lead'))
    );
  }
  return false;
}

export function canEditAttendance(user: User, attendanceUserId: string): boolean {
  if (isAdmin(user)) return true;
  // Uniquement sa propre présence
  return user.id === attendanceUserId;
}

// ============== RAPPORTS ==============

export function canGenerateOrgReport(user: User): boolean {
  return isAdmin(user);
}

export function canGenerateTeamReport(user: User, team?: Team): boolean {
  if (isAdmin(user)) return true;
  if (!team) return false;
  // Manager ou team_lead de cette équipe
  return (user.role === 'manager' || user.role === 'team_lead') && team.managerId === user.id;
}

export function canGenerateProjectReport(user: User, project?: Project): boolean {
  if (isAdmin(user)) return true;
  if (!project) return false;
  // Owner, lead, manager ou team_lead du projet
  if (user.role === 'manager' || user.role === 'team_lead') {
    return project.memberIds.includes(user.id);
  }
  return project.ownerId === user.id || 
         project.members.some(m => m.userId === user.id && (m.role === 'owner' || m.role === 'lead'));
}

export function canViewAllReports(user: User): boolean {
  return isAdmin(user);
}

export function canViewReport(user: User, reportTeamId: string | undefined, teams: Team[], projects: Project[]): boolean {
  if (isAdmin(user)) return true;
  if (!reportTeamId) return false;
  // Manager/team_lead de l'équipe ou d'un projet de l'équipe
  const team = teams.find(t => t.id === reportTeamId);
  if (team && team.managerId === user.id) return true;
  // Membre d'un projet lié à cette équipe
  return projects.some(p => 
    p.teamIds.includes(reportTeamId) && p.memberIds.includes(user.id)
  );
}

// ============== OBJECTIFS ==============

export function canCreateOrgObjective(user: User): boolean {
  return isAdmin(user);
}

export function canCreateTeamObjective(user: User, team?: Team): boolean {
  if (isAdmin(user)) return true;
  if (!team) return false;
  return (user.role === 'manager' || user.role === 'team_lead') && team.managerId === user.id;
}

export function canCreateProjectObjective(user: User, project?: Project): boolean {
  if (isAdmin(user)) return true;
  if (!project) return false;
  if (user.role === 'manager' || user.role === 'team_lead') {
    return project.memberIds.includes(user.id);
  }
  return project.ownerId === user.id || 
         project.members.some(m => m.userId === user.id && (m.role === 'owner' || m.role === 'lead'));
}

export function canCreateIndividualObjective(user: User): boolean {
  // Tout le monde sauf viewer
  return user.role !== 'viewer';
}

export function canDeleteObjective(user: User): boolean {
  return isAdmin(user);
}

export function canCreateObjective(user: User): boolean {
  return isAdmin(user);
}

export function canViewAllObjectives(user: User): boolean {
  return isAdmin(user);
}

// ============== ANALYTIQUE ==============

export function canViewOrgAnalytics(user: User): boolean {
  return isAdmin(user);
}

export function canViewTeamAnalytics(user: User, team?: Team): boolean {
  if (isAdmin(user)) return true;
  if (!team) return false;
  return (user.role === 'manager' || user.role === 'team_lead') && team.managerId === user.id;
}

export function canViewProjectAnalytics(user: User, project?: Project): boolean {
  if (isAdmin(user)) return true;
  if (!project) return false;
  if (user.role === 'manager' || user.role === 'team_lead') {
    return project.memberIds.includes(user.id);
  }
  return project.ownerId === user.id || 
         project.members.some(m => m.userId === user.id && (m.role === 'owner' || m.role === 'lead'));
}

// ============== MENU VISIBILITY ==============

export function canViewKanbanBoard(user: User): boolean {
  // Tous sauf user et viewer (ils ont "Mon Travail" à la place)
  return user.role !== 'user' && user.role !== 'viewer';
}

export function canViewProjectsView(user: User): boolean {
  // Tous peuvent voir leurs projets
  return true;
}

export function canViewAttendanceView(user: User): boolean {
  // Tous peuvent voir (mais filtré selon permissions)
  return true;
}

export function canViewTeamsView(user: User): boolean {
  // Admins et managers
  return isAdmin(user) || user.role === 'manager' || user.role === 'team_lead';
}

export function canViewObjectivesView(user: User): boolean {
  // Tous sauf viewer
  return user.role !== 'viewer';
}

export function canViewReportsView(user: User): boolean {
  // Admins et management
  return isManagement(user);
}

export function canViewAnalyticsView(user: User): boolean {
  // Admins et management
  return isManagement(user);
}
