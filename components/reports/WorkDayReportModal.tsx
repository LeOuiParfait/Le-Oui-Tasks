'use client'

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ListChecks,
  Sparkles,
  Send,
  Save
} from 'lucide-react';
import { User, Task, AttendanceRecord, WorkDayReport } from '@/types';
import { store } from '@/lib/services/store';

interface WorkDayReportModalProps {
  currentUser: User;
  tasks: Task[];
  attendanceRecord: AttendanceRecord | undefined;
  onClose: () => void;
  onSubmitted: () => void;
}

export const WorkDayReportModal: React.FC<WorkDayReportModalProps> = ({
  currentUser,
  tasks,
  attendanceRecord,
  onClose,
  onSubmitted
}) => {
  const [summary, setSummary] = useState('');
  const [achievements, setAchievements] = useState('');
  const [challenges, setChallenges] = useState('');
  const [planTomorrow, setPlanTomorrow] = useState('');
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [taskProgressNotes, setTaskProgressNotes] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mes tâches assignées
  const myTasks = useMemo(() => {
    return tasks.filter(t => t.assigneeIds?.includes(currentUser.id));
  }, [tasks, currentUser.id]);

  const toggleTask = (taskId: string) => {
    setSelectedTaskIds(prev =>
      prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]
    );
  };

  const getEffectiveBreakMinutes = (r: AttendanceRecord | undefined) => {
    if (!r) return 0;
    let breakMins = r.totalBreakMinutes || 0;
    if (r.status === 'on_break' && r.breakStartTime) {
      breakMins += (Date.now() - new Date(r.breakStartTime).getTime()) / 60000;
    }
    return Math.round(breakMins);
  };

  const getEffectiveWorkMinutes = (r: AttendanceRecord | undefined) => {
    if (!r) return 0;
    if (r.status === 'completed') return r.totalWorkMinutes || 0;
    if (!r.startTime) return r.totalWorkMinutes || 0;
    const [sh, sm] = r.startTime.split(':').map(Number);
    const start = new Date();
    start.setHours(sh, sm, 0, 0);
    let elapsed = (Date.now() - start.getTime()) / 60000;
    if (elapsed < 0) elapsed += 24 * 60;
    return Math.max(0, Math.round(elapsed - getEffectiveBreakMinutes(r)));
  };

  const formatDuration = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}min`;
    return `${h}h ${m}min`;
  };

  const handleSubmit = async (asDraft: boolean = false) => {
    setError(null);

    if (!asDraft && !summary.trim()) {
      setError('Le bilan global est obligatoire pour soumettre.');
      return;
    }

    setSubmitting(true);
    try {
      const tasksWorkedOn = selectedTaskIds.map(taskId => {
        const task = myTasks.find(t => t.id === taskId);
        return {
          taskId,
          taskTitle: task?.title || 'Tâche',
          progressNote: taskProgressNotes[taskId] || ''
        };
      });

      const reportData = {
        summary: summary.trim(),
        tasksWorkedOn,
        achievements: achievements.trim(),
        challenges: challenges.trim(),
        planTomorrow: planTomorrow.trim(),
        workMinutes: getEffectiveWorkMinutes(attendanceRecord),
        breakMinutes: getEffectiveBreakMinutes(attendanceRecord),
        startTime: attendanceRecord?.startTime,
        endTime: attendanceRecord?.endTime
      };

      if (asDraft) {
        await store.saveWorkDayReportDraft(reportData);
      } else {
        await store.submitWorkDayReport(reportData);
        onSubmitted();
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la soumission.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white px-5 py-4 border-b border-stone-100 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-brand" />
            <div>
              <h2 className="font-brand text-lg font-medium text-stone-900">Bilan de fin de journée</h2>
              <p className="text-[11px] text-stone-500">
                {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-stone-400 hover:text-stone-900 hover:bg-stone-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Récap présence */}
          {attendanceRecord && (
            <div className="bg-stone-50 rounded-lg p-3 border border-stone-100">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[10px] text-stone-500 uppercase tracking-wider font-semibold">Début</p>
                  <p className="text-sm font-semibold text-stone-900">{attendanceRecord.startTime || '-'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-stone-500 uppercase tracking-wider font-semibold">Fin</p>
                  <p className="text-sm font-semibold text-stone-900">{attendanceRecord.endTime || '-'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-stone-500 uppercase tracking-wider font-semibold">Travail</p>
                  <p className="text-sm font-semibold text-brand">{formatDuration(getEffectiveWorkMinutes(attendanceRecord))}</p>
                </div>
              </div>
            </div>
          )}

          {/* Bilan global */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-2">
              Bilan global de la journée <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={3}
              className="w-full bg-white border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-all resize-none"
              placeholder="Résumé de votre journée..."
              autoFocus
            />
          </div>

          {/* Tâches travaillées */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-stone-700 mb-2">
              <ListChecks className="w-3.5 h-3.5" />
              Tâches sur lesquelles vous avez travaillé
            </label>
            {myTasks.length === 0 ? (
              <p className="text-xs text-stone-400 italic bg-stone-50 p-3 rounded-lg">
                Aucune tâche ne vous est assignée.
              </p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {myTasks.map(task => (
                  <div
                    key={task.id}
                    className={`border rounded-lg p-3 transition-colors ${
                      selectedTaskIds.includes(task.id)
                        ? 'border-brand bg-brand-50/50'
                        : 'border-stone-200 bg-white'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <button
                        onClick={() => toggleTask(task.id)}
                        className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                          selectedTaskIds.includes(task.id)
                            ? 'bg-brand border-brand text-white'
                            : 'border-stone-300 hover:border-brand'
                        }`}
                      >
                        {selectedTaskIds.includes(task.id) && <CheckCircle2 className="w-3 h-3" />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-stone-900 truncate">{task.title}</p>
                        <p className="text-[10px] text-stone-500 uppercase tracking-wider">{task.status}</p>
                        {selectedTaskIds.includes(task.id) && (
                          <input
                            type="text"
                            value={taskProgressNotes[task.id] || ''}
                            onChange={(e) => setTaskProgressNotes(prev => ({ ...prev, [task.id]: e.target.value }))}
                            className="mt-2 w-full text-xs border border-stone-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand"
                            placeholder="Note de progression : ce que vous avez fait sur cette tâche..."
                          />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Achievements */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-stone-700 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
              Ce que vous avez accompli
            </label>
            <textarea
              value={achievements}
              onChange={(e) => setAchievements(e.target.value)}
              rows={2}
              className="w-full bg-white border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-all resize-none"
              placeholder="Succès, livrables, étapes franchies..."
            />
          </div>

          {/* Challenges */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-stone-700 mb-2">
              <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
              Difficultés rencontrées
            </label>
            <textarea
              value={challenges}
              onChange={(e) => setChallenges(e.target.value)}
              rows={2}
              className="w-full bg-white border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-all resize-none"
              placeholder="Blocages, problèmes techniques, retards..."
            />
          </div>

          {/* Plan demain */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-stone-700 mb-2">
              <Send className="w-3.5 h-3.5 text-brand" />
              Plan pour demain
            </label>
            <textarea
              value={planTomorrow}
              onChange={(e) => setPlanTomorrow(e.target.value)}
              rows={2}
              className="w-full bg-white border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition-all resize-none"
              placeholder="Priorités, tâches à reprendre, objectifs..."
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2 border-t border-stone-100">
            <button
              onClick={() => handleSubmit(true)}
              disabled={submitting}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-stone-200 text-stone-600 text-sm font-medium hover:bg-stone-50 transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>Brouillon</span>
            </button>
            <button
              onClick={() => handleSubmit(false)}
              disabled={submitting || !summary.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-brand hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span>{submitting ? 'Soumission...' : 'Soumettre le bilan'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
