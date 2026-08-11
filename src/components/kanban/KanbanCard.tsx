import React, { useState } from 'react';
import {
  MoreVertical,
  Flag,
  ListTree,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Circle,
  AlertCircle
} from 'lucide-react';
import { Task, User, TaskDifficulty, TaskPriority } from '../../types';

interface KanbanCardProps {
  task: Task;
  users: User[];
  onOpenDetail: (task: Task) => void;
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
}

export const KanbanCard: React.FC<KanbanCardProps> = ({
  task,
  users,
  onOpenDetail,
  onToggleSubtask
}) => {
  const [subtasksOpen, setSubtasksOpen] = useState(false);

  // Assignees
  const taskAssignees = users.filter((u) => task.assigneeIds.includes(u.id));

  // Subtask progress
  const completedSubtasksCount = task.subtasks.filter((s) => s.completed).length;
  const totalSubtasksCount = task.subtasks.length;
  const progressRatio = totalSubtasksCount > 0 ? completedSubtasksCount / totalSubtasksCount : 0;

  // Difficulty badge text
  const getDifficultyText = (diff: TaskDifficulty) => {
    switch (diff) {
      case 'Easy':
        return 'Facile';
      case 'Medium':
        return 'Moyen';
      case 'Hard':
        return 'Difficile';
      default:
        return diff;
    }
  };

  // Difficulty badge styles
  const getDifficultyBadge = (diff: TaskDifficulty) => {
    switch (diff) {
      case 'Easy':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'Medium':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'Hard':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      default:
        return 'bg-stone-100 text-stone-700 border-stone-200';
    }
  };

  // Priority Flag Color
  const getPriorityFlagColor = (prio: TaskPriority) => {
    switch (prio) {
      case 'Critical':
      case 'High':
        return 'text-rose-500 fill-rose-500';
      case 'Medium':
        return 'text-amber-500 fill-amber-500';
      default:
        return 'text-stone-400';
    }
  };

  return (
    <div
      onClick={() => onOpenDetail(task)}
      className="bg-white rounded-xl border border-stone-200/90 p-4 shadow-sm hover:shadow-md transition-all cursor-pointer group mb-3 relative"
    >
      {/* Top Badge & Menu Row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          {/* Difficulty Badge */}
          <span
            className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${getDifficultyBadge(
              task.difficulty
            )}`}
          >
            {getDifficultyText(task.difficulty)}
          </span>

          {/* Priority Flag */}
          {(task.priority === 'High' || task.priority === 'Critical') && (
            <Flag className={`w-3.5 h-3.5 ${getPriorityFlagColor(task.priority)}`} />
          )}

          {/* Blocker Alert Tag */}
          {task.status === 'Blocked' && (
            <span className="flex items-center space-x-1 text-[10px] font-bold bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full">
              <AlertCircle className="w-3 h-3" />
              <span>Bloqué</span>
            </span>
          )}
        </div>

        {/* 3 Dots Menu */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenDetail(task);
          }}
          className="text-stone-300 hover:text-stone-600 p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>

      {/* Task Title */}
      <h3 className="font-semibold text-stone-900 text-sm mb-2.5 line-clamp-2 leading-snug group-hover:text-brand transition-colors">
        {task.title}
      </h3>

      {/* Subtasks Collapsible */}
      {totalSubtasksCount > 0 && (
        <div className="mb-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSubtasksOpen(!subtasksOpen);
            }}
            className="flex items-center space-x-1.5 text-xs font-semibold text-brand hover:text-brand-dark transition-colors"
          >
            <ListTree className="w-3.5 h-3.5" />
            <span>Sous-tâches</span>
            {subtasksOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {/* Subtask list items if expanded */}
          {subtasksOpen && (
            <div className="mt-2 space-y-1.5 bg-stone-50/80 rounded-xl p-2.5 border border-stone-100">
              {task.subtasks.map((st) => (
                <div
                  key={st.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleSubtask(task.id, st.id);
                  }}
                  className="flex items-center space-x-2 text-xs text-stone-700 hover:text-stone-900 cursor-pointer py-0.5"
                >
                  {st.completed ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-brand shrink-0" />
                  ) : (
                    <Circle className="w-3.5 h-3.5 text-stone-300 shrink-0" />
                  )}
                  <span className={st.completed ? 'line-through text-stone-400' : ''}>{st.title}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Segmented Progress Bar matching screenshot exact style */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-[10px] font-bold text-stone-400 tracking-wider mb-1.5 uppercase">
          <span>Progression</span>
          <span>
            {completedSubtasksCount}/{totalSubtasksCount || 1}
          </span>
        </div>

        {/* 4 Segmented Progress Bar */}
        <div className="grid grid-cols-4 gap-1">
          {[1, 2, 3, 4].map((seg) => {
            const segRatio = seg / 4;
            const isFilled = progressRatio >= segRatio - 0.2;
            return (
              <div
                key={seg}
                className={`h-1.5 rounded-full transition-all ${
                  isFilled ? 'bg-brand' : 'bg-stone-100'
                }`}
              />
            );
          })}
        </div>
      </div>

      {/* Assignee Avatars Row */}
      <div className="flex items-center justify-between pt-1 border-t border-stone-100/60">
        <div className="flex items-center -space-x-1.5">
          {taskAssignees.map((user) => (
            user.avatar ? (
              <img
                key={user.id}
                src={user.avatar}
                alt={`${user.firstName} ${user.lastName}`}
                title={`${user.firstName} ${user.lastName}`}
                className="w-6 h-6 rounded-full ring-2 ring-white object-cover"
              />
            ) : (
              <div
                key={user.id}
                title={`${user.firstName} ${user.lastName}`}
                className="w-6 h-6 rounded-full bg-brand flex items-center justify-center text-white text-[9px] font-semibold ring-2 ring-white"
              >
                {user.firstName.charAt(0)}{user.lastName.charAt(0)}
              </div>
            )
          ))}
          {taskAssignees.length === 0 && (
            <span className="text-[11px] text-stone-400 italic">Non assigné</span>
          )}
        </div>

        {/* Validation Status Indicator */}
        {task.status === 'In Review' && (
          <span className="text-[10px] font-semibold bg-amber-50 text-amber-700 px-2 py-0.5 rounded-md border border-amber-200/60">
            En révision
          </span>
        )}
        {task.status === 'Completed' && (
          <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md border border-emerald-200/60">
            Validé
          </span>
        )}
      </div>
    </div>
  );
};
