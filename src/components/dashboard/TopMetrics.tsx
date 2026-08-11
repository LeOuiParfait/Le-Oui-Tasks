import React from 'react';
import { ListFilter, CheckSquare, Clock, Users } from 'lucide-react';

interface TopMetricsProps {
  activeProjectsCount?: number;
  completedTasksCount?: number;
  upcomingDeadlinesCount?: number;
  activeTeamMembersCount?: number;
}

export const TopMetrics: React.FC<TopMetricsProps> = ({
  activeProjectsCount = 42,
  completedTasksCount = 2,
  upcomingDeadlinesCount = 12,
  activeTeamMembersCount = 8
}) => {
  const metrics = [
    {
      id: 'active_projects',
      label: 'PROJETS ACTIFS',
      value: activeProjectsCount,
      icon: ListFilter,
      iconBg: 'bg-stone-100 text-stone-500'
    },
    {
      id: 'task_completed',
      label: 'TÂCHES TERMINÉES',
      value: completedTasksCount,
      icon: CheckSquare,
      iconBg: 'bg-stone-100 text-stone-500'
    },
    {
      id: 'upcoming_deadlines',
      label: 'ÉCHÉANCES À VENIR',
      value: upcomingDeadlinesCount,
      icon: Clock,
      iconBg: 'bg-stone-100 text-stone-500'
    },
    {
      id: 'active_team_members',
      label: 'MEMBRES ACTIFS',
      value: activeTeamMembersCount,
      icon: Users,
      iconBg: 'bg-stone-100 text-stone-500'
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-4 sm:mb-6">
      {metrics.map((m) => {
        const IconComponent = m.icon;
        return (
          <div
            key={m.id}
            className="bg-white rounded-xl border border-stone-200/80 p-5 flex flex-col items-center justify-center text-center shadow-xs hover:shadow-sm transition-all"
          >
            <div className={`p-2.5 rounded-full ${m.iconBg} mb-2.5 flex items-center justify-center`}>
              <IconComponent className="w-5 h-5 text-stone-400" />
            </div>
            <span className="text-[11px] font-semibold text-stone-500 tracking-wider uppercase mb-1">
              {m.label}
            </span>
            <span className="text-2xl font-bold text-stone-900 tracking-tight">{m.value}</span>
          </div>
        );
      })}
    </div>
  );
};
