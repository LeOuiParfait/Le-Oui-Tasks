import React, { useState, useEffect } from 'react';
import {
  X, Clock, UserCheck, MessageSquare, Send, CheckCircle2, XCircle, Plus, Trash2, Flag, Calendar, ShieldAlert
} from 'lucide-react';
import { Task, User, Project, Comment, TaskStatus } from '../../types';
import { canApproveTask, canDeleteTask } from '../../services/permissions';
import { store } from '../../services/store';

interface TaskDetailModalProps {
  task: Task | null;
  users: User[];
  projects: Project[];
  currentUser: User;
  comments: Comment[];
  onClose: () => void;
  onUpdateStatus: (taskId: string, newStatus: TaskStatus, blockerReason?: string) => void;
  onSubmitForReview: (taskId: string) => void;
  onApproveTask: (taskId: string, comment?: string) => void;
  onRejectTask: (taskId: string, feedback: string) => void;
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
  onAddSubtask: (taskId: string, title: string) => void;
  onAddComment: (taskId: string, content: string) => void;
  onDeleteTask: (taskId: string) => void;
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  task, users, projects, currentUser, comments,
  onClose, onUpdateStatus, onSubmitForReview, onApproveTask, onRejectTask,
  onToggleSubtask, onAddSubtask, onAddComment, onDeleteTask
}) => {
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newCommentText, setNewCommentText] = useState('');
  const [rejectFeedback, setRejectFeedback] = useState('');
  const [approveComment, setApproveComment] = useState('');
  const [blockerReasonInput, setBlockerReasonInput] = useState(task?.blockerReason || '');
  const [showRejectBox, setShowRejectBox] = useState(false);
  const [showBlockerBox, setShowBlockerBox] = useState(false);

  // Subscribe to real-time comments when task opens
  useEffect(() => {
    if (task?.id) {
      store.subscribeTaskComments(task.id);
      return () => {
        store.unsubscribeTaskComments(task.id);
      };
    }
  }, [task?.id]);

  if (!task) return null;

  const project = projects.find((p) => p.id === task.projectId);
  const assignees = users.filter((u) => task.assigneeIds.includes(u.id));
  const reviewer = users.find((u) => u.id === task.reviewerId);

  const canApprove = canApproveTask(currentUser);
  const canDelete = canDeleteTask(currentUser);

  const handleSubtaskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim()) return;
    onAddSubtask(task.id, newSubtaskTitle.trim());
    setNewSubtaskTitle('');
  };

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;
    onAddComment(task.id, newCommentText.trim());
    setNewCommentText('');
  };

  const handleApproveSubmit = () => {
    onApproveTask(task.id, approveComment);
    setApproveComment('');
  };

  const handleRejectSubmit = () => {
    if (!rejectFeedback.trim()) return;
    onRejectTask(task.id, rejectFeedback.trim());
    setShowRejectBox(false);
    setRejectFeedback('');
  };

  const handleMarkBlockedSubmit = () => {
    if (!blockerReasonInput.trim()) return;
    onUpdateStatus(task.id, 'Blocked', blockerReasonInput.trim());
    setShowBlockerBox(false);
  };

  const Avatar: React.FC<{ user?: User; size?: string }> = ({ user, size = 'w-5 h-5' }) => {
    if (!user) return null;
    if (user.avatar) return <img src={user.avatar} alt="" className={`${size} rounded-full object-cover`} />;
    return (
      <div className={`${size} rounded-full bg-brand flex items-center justify-center text-white text-[10px] font-semibold`}>
        {user.firstName.charAt(0)}{user.lastName.charAt(0)}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-xl max-w-3xl w-full shadow-xl overflow-hidden my-8 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-brand-100 text-brand-dark">
              {project?.name || 'Tâche Générale'}
            </span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-stone-100 text-stone-700">
              {task.difficulty}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {canDelete && (
              <button
                onClick={() => { if (confirm(`Supprimer la tâche « ${task.title} » ?`)) { onDeleteTask(task.id); onClose(); } }}
                className="p-2 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                title="Supprimer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button onClick={onClose} className="p-2 rounded-lg text-stone-400 hover:text-stone-900 hover:bg-stone-100 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5 no-scrollbar">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-stone-400 uppercase tracking-wider mb-1">
              <Flag className="w-3.5 h-3.5 text-rose-500" />
              <span>Priorité : {task.priority}</span>
            </div>
            <h2 className="text-xl font-bold text-stone-900 tracking-tight">{task.title}</h2>
          </div>

          {/* Status Bar */}
          <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-xs text-stone-500 font-medium block">Statut Actuel</span>
              <span className="text-sm font-bold text-stone-900">{task.status}</span>
            </div>
            <div className="flex items-center gap-2">
              {task.status !== 'In Review' && task.status !== 'Completed' && (
                <button
                  onClick={() => onSubmitForReview(task.id)}
                  className="px-3 py-2 bg-brand hover:bg-brand-dark text-white font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>Soumettre pour Révision</span>
                </button>
              )}
              {task.status === 'In Review' && canApprove && (
                <>
                  <button
                    onClick={handleApproveSubmit}
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Approuver</span>
                  </button>
                  <button
                    onClick={() => setShowRejectBox(!showRejectBox)}
                    className="px-3 py-2 bg-rose-100 hover:bg-rose-200 text-rose-800 font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Refuser</span>
                  </button>
                </>
              )}
              {task.status !== 'Blocked' && (
                <button
                  onClick={() => setShowBlockerBox(!showBlockerBox)}
                  className="px-3 py-2 bg-stone-100 hover:bg-rose-50 text-stone-700 hover:text-rose-700 font-medium text-xs rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Bloquer</span>
                </button>
              )}
            </div>
          </div>

          {showRejectBox && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 space-y-3">
              <h4 className="text-xs font-bold text-rose-900 uppercase">Modifications requises</h4>
              <textarea value={rejectFeedback} onChange={(e) => setRejectFeedback(e.target.value)} placeholder="Détaillez ce qui doit être corrigé..." className="w-full bg-white border border-rose-200 rounded-lg p-3 text-xs focus:outline-none focus:border-rose-500" rows={2} />
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowRejectBox(false)} className="px-3 py-1.5 text-xs font-medium text-stone-600 hover:text-stone-900">Annuler</button>
                <button onClick={handleRejectSubmit} className="px-3.5 py-1.5 bg-rose-600 text-white text-xs font-semibold rounded-lg hover:bg-rose-700">Confirmer</button>
              </div>
            </div>
          )}

          {showBlockerBox && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
              <h4 className="text-xs font-bold text-amber-900 uppercase">Raison du blocage</h4>
              <input type="text" value={blockerReasonInput} onChange={(e) => setBlockerReasonInput(e.target.value)} placeholder="Ex : En attente des accès API..." className="w-full bg-white border border-amber-200 rounded-lg p-3 text-xs focus:outline-none focus:border-amber-500" />
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowBlockerBox(false)} className="px-3 py-1.5 text-xs font-medium text-stone-600 hover:text-stone-900">Annuler</button>
                <button onClick={handleMarkBlockedSubmit} className="px-3.5 py-1.5 bg-amber-600 text-white text-xs font-semibold rounded-lg hover:bg-amber-700">Confirmer</button>
              </div>
            </div>
          )}

          {/* Description */}
          <div>
            <h4 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-2">Description</h4>
            <p className="text-sm text-stone-700 leading-relaxed bg-stone-50/60 rounded-xl p-4 border border-stone-100">
              {task.description || 'Aucune description fournie.'}
            </p>
          </div>

          {/* Assignees & Reviewer & Due Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-stone-50 rounded-xl p-4 border border-stone-100">
              <span className="text-xs text-stone-400 font-semibold uppercase block mb-2">Assigné à</span>
              <div className="flex flex-wrap gap-2">
                {assignees.length === 0 ? (
                  <span className="text-xs text-stone-400">Non assigné</span>
                ) : assignees.map((u) => (
                  <div key={u.id} className="flex items-center gap-2 bg-white px-2.5 py-1 rounded-lg border border-stone-200">
                    <Avatar user={u} />
                    <span className="text-xs font-semibold text-stone-800">{u.firstName} {u.lastName}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-stone-50 rounded-xl p-4 border border-stone-100">
              <span className="text-xs text-stone-400 font-semibold uppercase block mb-2">Échéance</span>
              <div className="flex items-center gap-2 text-sm font-bold text-stone-900">
                <Calendar className="w-4 h-4 text-brand" />
                <span>{task.dueDate}</span>
              </div>
              {reviewer && (
                <div className="mt-2 flex items-center gap-2">
                  <Avatar user={reviewer} size="w-4 h-4" />
                  <span className="text-xs text-stone-600">Réviseur : {reviewer.firstName} {reviewer.lastName}</span>
                </div>
              )}
            </div>
          </div>

          {/* Subtasks */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-stone-400 uppercase tracking-wider">
                Sous-tâches ({task.subtasks.filter((s) => s.completed).length}/{task.subtasks.length})
              </h4>
            </div>
            <div className="space-y-2 mb-3">
              {task.subtasks.map((st) => (
                <div key={st.id} onClick={() => onToggleSubtask(task.id, st.id)} className="flex items-center justify-between p-3 rounded-lg bg-stone-50 hover:bg-stone-100 cursor-pointer border border-stone-100 transition-colors">
                  <div className="flex items-center gap-3">
                    <input type="checkbox" checked={st.completed} onChange={() => {}} className="w-4 h-4 text-brand rounded border-stone-300 focus:ring-brand" />
                    <span className={`text-xs font-medium ${st.completed ? 'line-through text-stone-400' : 'text-stone-900'}`}>{st.title}</span>
                  </div>
                </div>
              ))}
            </div>
            <form onSubmit={handleSubtaskSubmit} className="flex items-center gap-2">
              <input type="text" placeholder="Ajouter une sous-tâche..." value={newSubtaskTitle} onChange={(e) => setNewSubtaskTitle(e.target.value)} className="flex-1 bg-white border border-stone-200 rounded-lg px-3.5 py-2 text-xs focus:outline-none focus:border-brand" />
              <button type="submit" className="px-3.5 py-2 bg-stone-900 text-white text-xs font-semibold rounded-lg hover:bg-stone-800 transition-colors flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" />
                <span>Ajouter</span>
              </button>
            </form>
          </div>

          {/* Comments */}
          <div className="pt-4 border-t border-stone-100">
            <h4 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-stone-500" />
              <span>Commentaires ({comments.length})</span>
            </h4>
            <div className="space-y-3 mb-4">
              {comments.map((c) => {
                const author = users.find((u) => u.id === c.authorId);
                return (
                  <div key={c.id} className="flex gap-3 p-3 bg-stone-50/80 rounded-xl border border-stone-100">
                    <Avatar user={author} size="w-8 h-8" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-stone-900">{author?.firstName} {author?.lastName}</span>
                        <span className="text-[10px] text-stone-400">{new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="text-xs text-stone-700 leading-relaxed">{c.content}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <form onSubmit={handleCommentSubmit} className="flex items-center gap-2">
              <input type="text" placeholder="Écrire un commentaire..." value={newCommentText} onChange={(e) => setNewCommentText(e.target.value)} className="flex-1 bg-white border border-stone-200 rounded-lg px-4 py-2.5 text-xs focus:outline-none focus:border-brand shadow-sm" />
              <button type="submit" className="px-4 py-2.5 bg-brand text-white text-xs font-semibold rounded-lg hover:bg-brand-dark transition-colors flex items-center gap-1.5 shrink-0">
                <Send className="w-3.5 h-3.5" />
                <span>Publier</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
