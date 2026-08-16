'use client'

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { Task, User, Project, Team } from '@/types';
import { AlertCircle, TrendingUp, Users, CheckSquare, Layers } from 'lucide-react';

interface AnalyticsViewProps {
  tasks: Task[];
  users: User[];
  projects: Project[];
  teams: Team[];
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  tasks,
  users,
  projects,
  teams
}) => {
  // Workload distribution data
  const workloadData = users.map((u) => {
    const userTasks = tasks.filter((t) => t.assigneeIds.includes(u.id) && t.status !== 'Completed');
    return {
      name: u.firstName,
      tasks: userTasks.length,
      isOverloaded: userTasks.length > 5
    };
  });

  // Task Status distribution data
  const statusCounts = {
    Todo: tasks.filter((t) => t.status === 'Todo').length,
    InProgress: tasks.filter((t) => t.status === 'In Progress').length,
    InReview: tasks.filter((t) => t.status === 'In Review').length,
    Blocked: tasks.filter((t) => t.status === 'Blocked').length,
    Completed: tasks.filter((t) => t.status === 'Completed').length
  };

  const pieData = [
    { name: 'Terminées', value: statusCounts.Completed, color: '#10B981' },
    { name: 'En cours', value: statusCounts.InProgress, color: '#F59E0B' },
    { name: 'En révision', value: statusCounts.InReview, color: '#3B82F6' },
    { name: 'Bloquées', value: statusCounts.Blocked, color: '#EF4444' },
    { name: 'À faire', value: statusCounts.Todo, color: '#8B5CF6' }
  ];

  const overloadedUsers = workloadData.filter((w) => w.isOverloaded);

  return (
    <div className="space-y-4 sm:space-y-6 pb-12 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-stone-900 tracking-tight">Analytiques de Gestion</h1>
        <p className="text-xs text-stone-500 mt-0.5">
          Indicateurs de performance, répartition de la charge de travail et gestion des risques de livraison.
        </p>
      </div>

      {/* Overloaded Alert Banner */}
      {overloadedUsers.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center space-x-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <h4 className="text-xs font-bold text-amber-900">Avertissement de Charge Déséquilibrée</h4>
            <p className="text-xs text-amber-700 mt-0.5">
              {overloadedUsers.map((u) => `${u.name} (${u.tasks} tâches)`).join(', ')} dépassent la capacité standard (&gt;5 tâches actives). Pensez à réassigner des tâches pour rééquilibrer la charge.
            </p>
          </div>
        </div>
      )}

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Workload Bar Chart */}
        <div className="bg-white rounded-xl border border-stone-200 p-4 sm:p-6 shadow-xs">
          <h3 className="text-sm font-bold text-stone-900 mb-1">Répartition de la Charge de Travail</h3>
          <p className="text-xs text-stone-500 mb-4">Tâches actives assignées par membre d'équipe</p>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={workloadData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="tasks" fill="#2563EB" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Task Status Breakdown Pie Chart */}
        <div className="bg-white rounded-xl border border-stone-200 p-4 sm:p-6 shadow-xs">
          <h3 className="text-sm font-bold text-stone-900 mb-1">Répartition des Tâches par Statut</h3>
          <p className="text-xs text-stone-500 mb-4">Proportion des tâches dans les différentes colonnes</p>

          <div className="h-64 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-wrap justify-center gap-3 text-xs font-semibold pt-2">
            {pieData.map((d) => (
              <div key={d.name} className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="text-stone-700">{d.name}: {d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
