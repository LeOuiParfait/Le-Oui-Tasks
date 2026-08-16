'use client'

import React, { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Send,
  ChevronRight,
  Calendar,
  Circle,
  Loader2,
  Sparkles
} from 'lucide-react';
import { Task, User, Objective, AttendanceRecord, TaskStatus } from '@/types';

interface MyWorkViewProps {
  currentUser: User;
  tasks: Task[];
  objectives: Objective[];
  attendanceRecord?: AttendanceRecord;
  onOpenTaskDetail: (task: Task) => void;
  onUpdateTaskStatus: (taskId: string, status: TaskStatus) => void;
  onStartWorkday: () => void;
}

export const MyWorkView: React.FC<MyWorkViewProps> = ({
  currentUser,
  tasks,
  objectives,
  attendanceRecord,
  onOpenTaskDetail,
  onUpdateTaskStatus,
  onStartWorkday
}) => {
  const [reflectionText, setReflectionText] = useState('');
  const [reflectionSaved, setReflectionSaved] = useState(false);
  const [savingReflection, setSavingReflection] = useState(false);

  const myTasks = tasks.filter((t) => t.assigneeIds.includes(currentUser.id));
  const todayTasks = myTasks.filter((t) => t.status !== 'Completed');
  const completedToday = myTasks.filter((t) => t.status === 'Completed');

  const nowStr = new Date().toISOString().split('T')[0];
  const overdueTasks = todayTasks.filter((t) => t.dueDate < nowStr);

  const isWorking = attendanceRecord && attendanceRecord.status === 'working';

  const handleSaveReflection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reflectionText.trim()) return;
    setSavingReflection(true);
    setTimeout(() => {
      setSavingReflection(false);
      setReflectionSaved(true);
      setReflectionText('');
      setTimeout(() => setReflectionSaved(false), 3000);
    }, 600);
  };

  const getTaskStatusStyle = (status: TaskStatus) => {
    switch (status) {
      case 'In Progress': return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', label: 'En cours' };
      case 'In Review': return { bg: 'bg-brand-50', text: 'text-brand-dark', border: 'border-brand-100', label: 'En révision' };
      case 'Blocked': return { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', label: 'Bloqué' };
      case 'Backlog': return { bg: 'bg-stone-100', text: 'text-stone-600', border: 'border-stone-200', label: 'Backlog' };
      default: return { bg: 'bg-stone-100', text: 'text-stone-600', border: 'border-stone-200', label: status };
    }
  };

  const getDifficultyStyle = (difficulty: string) => {
    switch (difficulty) {
      case 'Easy': return 'bg-emerald-100 text-emerald-700';
      case 'Medium': return 'bg-amber-100 text-amber-700';
      case 'Hard': return 'bg-rose-100 text-rose-700';
      default: return 'bg-stone-100 text-stone-600';
    }
  };

  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const completionRate = myTasks.length > 0 ? Math.round((completedToday.length / myTasks.length) * 100) : 0;

  return (
    <div className="space-y-4 sm:space-y-6 pb-12 max-w-5xl mx-auto">
      {/* Header — clean, professional, no gradient */}
      <div className="bg-white rounded-xl border border-stone-200 p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {currentUser.avatar ? (
              <img src={currentUser.avatar} alt="" className="w-14 h-14 rounded-full object-cover border border-stone-200" />
            ) : (
              <div className="w-14 h-14 rounded-full bg-brand flex items-center justify-center text-white text-lg font-semibold border border-stone-200">
                {currentUser.firstName.charAt(0)}{currentUser.lastName.charAt(0)}
              </div>
            )}
            <div>
              <p className="text-xs text-stone-400 font-medium capitalize mb-0.5">{today}</p>
              <h1 className="text-xl font-bold text-stone-900 tracking-tight">Bonjour, {currentUser.firstName}</h1>
              <p className="text-xs text-stone-500 mt-0.5">
                {isWorking
                  ? `Journée démarrée à ${attendanceRecord.startTime} · ${todayTasks.length} tâche${todayTasks.length > 1 ? 's' : ''} en cours`
                  : 'Votre journée n\'est pas démarrée. Pointez pour débuter votre suivi.'}
              </p>
            </div>
          </div>

          {!isWorking && (
            <button
              onClick={onStartWorkday}
              className="px-4 py-2.5 bg-brand hover:bg-brand-dark text-white font-semibold text-xs rounded-lg transition-colors flex items-center gap-2 shrink-0"
            >
              <Clock className="w-4 h-4" />
              <span>Démarrer ma journée</span>
            </button>
          )}
        </div>

        {/* Quick stats row */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-5 pt-5 border-t border-stone-100">
          <div>
            <p className="text-2xl font-bold text-stone-900">{todayTasks.length}</p>
            <p className="text-xs text-stone-400 font-medium">Tâches actives</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-emerald-600">{completedToday.length}</p>
            <p className="text-xs text-stone-400 font-medium">Terminées</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-brand">{completionRate}%</p>
            <p className="text-xs text-stone-400 font-medium">Progression</p>
          </div>
        </div>
      </div>

      {/* Overdue alert */}
      {overdueTasks.length > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-rose-900">
              {overdueTasks.length} tâche{overdueTasks.length > 1 ? 's' : ''} en retard
            </h4>
            <p className="text-xs text-rose-700 mt-0.5">
              Les tâches en retard affectent les échéances du projet. Merci de mettre à jour votre progression.
            </p>
          </div>
        </div>
      )}

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Left 2 cols: tasks */}
        <div className="lg:col-span-2 space-y-6">
          {/* Today's tasks */}
          <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
              <h2 className="text-sm font-bold text-stone-900">Tâches du jour</h2>
              <span className="text-xs font-semibold bg-brand-50 text-brand-dark px-2.5 py-1 rounded-full">
                {todayTasks.length} en cours
              </span>
            </div>

            <div className="divide-y divide-stone-100">
              {todayTasks.map((task) => {
                const statusStyle = getTaskStatusStyle(task.status);
                const isOverdue = task.dueDate < nowStr;
                return (
                  <div
                    key={task.id}
                    onClick={() => onOpenTaskDetail(task)}
                    className="flex items-center gap-3 px-5 py-3.5 hover:bg-stone-50 cursor-pointer group transition-colors"
                  >
                    <button
                      onClick={(e) => { e.stopPropagation(); onUpdateTaskStatus(task.id, 'Completed'); }}
                      className="text-stone-300 hover:text-emerald-600 transition-colors shrink-0"
                      title="Marquer terminée"
                    >
                      <Circle className="w-5 h-5" />
                    </button>

                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-stone-900 group-hover:text-brand transition-colors truncate">
                        {task.title}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${getDifficultyStyle(task.difficulty)}`}>
                          {task.difficulty === 'Easy' ? 'Facile' : task.difficulty === 'Medium' ? 'Moyen' : 'Difficile'}
                        </span>
                        <span className={`text-[10px] font-medium flex items-center gap-1 ${isOverdue ? 'text-rose-600' : 'text-stone-400'}`}>
                          <Calendar className="w-3 h-3" />
                          {task.dueDate}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[10px] font-semibold px-2 py-1 rounded-full border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}>
                        {statusStyle.label}
                      </span>
                      <ChevronRight className="w-4 h-4 text-stone-300 group-hover:text-brand transition-colors" />
                    </div>
                  </div>
                );
              })}

              {todayTasks.length === 0 && (
                <div className="text-center py-12 px-5">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-stone-700">Toutes vos tâches sont terminées</p>
                  <p className="text-xs text-stone-400 mt-1">Aucune tâche en attente pour aujourd'hui.</p>
                </div>
              )}
            </div>
          </div>

          {/* Completed tasks */}
          {completedToday.length > 0 && (
            <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-stone-100">
                <h3 className="text-sm font-bold text-stone-900">Tâches terminées</h3>
              </div>
              <div className="divide-y divide-stone-100">
                {completedToday.map((task) => (
                  <div key={task.id} className="flex items-center gap-3 px-5 py-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                    <span className="text-sm text-stone-500 line-through flex-1 truncate">{task.title}</span>
                    <span className="text-[10px] text-stone-400 font-medium">Validé</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right col: reflection */}
        <div className="space-y-6">
          {/* Daily reflection */}
          <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-stone-100">
              <h3 className="text-sm font-bold text-stone-900">Journal du jour</h3>
              <p className="text-xs text-stone-400 mt-0.5">Résumez votre progression ou signalez vos blocages.</p>
            </div>
            <div className="p-4">
              <form onSubmit={handleSaveReflection} className="space-y-3">
                <textarea
                  rows={4}
                  value={reflectionText}
                  onChange={(e) => setReflectionText(e.target.value)}
                  placeholder="Aujourd'hui je me suis concentré sur..."
                  className="w-full bg-stone-50 border border-stone-200 rounded-lg p-3 text-xs focus:outline-none focus:border-brand focus:bg-white transition-colors resize-none"
                />
                <button
                  type="submit"
                  disabled={savingReflection || !reflectionText.trim()}
                  className="w-full py-2 bg-brand hover:bg-brand-dark text-white font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {savingReflection ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>Enregistrer</span>
                </button>
              </form>

              {reflectionSaved && (
                <div className="mt-3 flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Bilan enregistré dans le rapport quotidien.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
