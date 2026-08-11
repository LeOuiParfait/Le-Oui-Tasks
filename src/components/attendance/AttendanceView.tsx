import React, { useState } from 'react';
import {
  Clock,
  Play,
  Square,
  Coffee,
  Users,
  CheckCircle2,
  Calendar,
  AlertCircle,
  TrendingUp,
  Briefcase,
  LogIn,
  LogOut,
  Timer
} from 'lucide-react';
import { User, AttendanceRecord } from '../../types';

interface AttendanceViewProps {
  currentUser: User;
  users: User[];
  attendanceRecords: AttendanceRecord[];
  onStartWorkday: () => void;
  onEndWorkday: () => void;
  onToggleBreak: () => void;
}

export const AttendanceView: React.FC<AttendanceViewProps> = ({
  currentUser,
  users,
  attendanceRecords,
  onStartWorkday,
  onEndWorkday,
  onToggleBreak
}) => {
  const today = new Date().toISOString().split('T')[0];
  const myTodayRecord = attendanceRecords.find((r) => r.userId === currentUser.id && r.date === today);

  const isWorking = myTodayRecord && myTodayRecord.status === 'working';
  const isOnBreak = myTodayRecord && myTodayRecord.status === 'on_break';
  const isCompleted = myTodayRecord && myTodayRecord.status === 'completed';

  const onlineCount = users.filter((u) => u.presenceStatus === 'online').length;
  const awayCount = users.filter((u) => u.presenceStatus === 'away').length;
  const offlineCount = users.filter((u) => u.presenceStatus === 'offline').length;

  const statusConfig = (status: string) => {
    switch (status) {
      case 'online':
        return { label: 'En ligne', dot: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' };
      case 'away':
        return { label: 'En pause', dot: 'bg-amber-500', text: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' };
      case 'on_leave':
        return { label: 'En congé', dot: 'bg-purple-500', text: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' };
      default:
        return { label: 'Hors ligne', dot: 'bg-stone-300', text: 'text-stone-500', bg: 'bg-stone-50', border: 'border-stone-200' };
    }
  };

  const formatDuration = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'working':
        return { label: 'En cours', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' };
      case 'on_break':
        return { label: 'En pause', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' };
      case 'completed':
        return { label: 'Terminé', bg: 'bg-stone-100', text: 'text-stone-600', border: 'border-stone-200' };
      default:
        return { label: status, bg: 'bg-stone-100', text: 'text-stone-600', border: 'border-stone-200' };
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5 pb-12 max-w-6xl mx-auto">
      {/* === Section 1: Session de Présence === */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
        {/* Bandeau d'en-tête avec statut coloré */}
        <div className={`px-4 sm:px-6 py-4 border-b ${
          isWorking ? 'bg-emerald-50/60 border-emerald-100'
          : isOnBreak ? 'bg-amber-50/60 border-amber-100'
          : isCompleted ? 'bg-stone-50 border-stone-100'
          : 'bg-stone-50/60 border-stone-100'
        }`}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                isWorking ? 'bg-emerald-100 text-emerald-700'
                : isOnBreak ? 'bg-amber-100 text-amber-700'
                : isCompleted ? 'bg-stone-100 text-stone-500'
                : 'bg-stone-100 text-stone-500'
              }`}>
                {isWorking ? <Timer className="w-5 h-5" />
                : isOnBreak ? <Coffee className="w-5 h-5" />
                : isCompleted ? <CheckCircle2 className="w-5 h-5" />
                : <Clock className="w-5 h-5" />}
              </div>
              <div className="min-w-0">
                <h2 className="text-sm sm:text-base font-bold text-stone-900 tracking-tight">
                  {isWorking ? 'Vous êtes en service'
                  : isOnBreak ? 'Vous êtes en pause'
                  : isCompleted ? 'Journée terminée'
                  : 'Vous n\'avez pas encore pointé'}
                </h2>
                <p className="text-xs text-stone-500 mt-0.5 truncate">
                  {isWorking && myTodayRecord ? `Débuté à ${myTodayRecord.startTime}`
                  : isOnBreak && myTodayRecord ? `En pause depuis ${myTodayRecord.startTime}`
                  : isCompleted && myTodayRecord ? `${myTodayRecord.startTime} → ${myTodayRecord.endTime}`
                  : 'Pointez votre début de journée pour signaler votre disponibilité'}
                </p>
              </div>
            </div>

            {/* Indicateur visuel de statut */}
            <div className="flex items-center gap-2 shrink-0">
              {isWorking && (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="hidden sm:inline">En direct</span>
                </span>
              )}
              {isOnBreak && (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="hidden sm:inline">Pause</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Corps : actions */}
        <div className="px-4 sm:px-6 py-4">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {isWorking ? (
              <>
                <button
                  onClick={onToggleBreak}
                  className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold text-xs rounded-lg border border-amber-200 transition-colors"
                >
                  <Coffee className="w-4 h-4" />
                  <span>Démarrer une pause</span>
                </button>
                <button
                  onClick={onEndWorkday}
                  className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-lg transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Terminer la journée</span>
                </button>
              </>
            ) : isOnBreak ? (
              <button
                onClick={onToggleBreak}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg transition-colors"
              >
                <LogIn className="w-4 h-4" />
                <span>Reprendre le travail</span>
              </button>
            ) : isCompleted ? (
              <div className="flex items-center gap-2 text-xs text-stone-500 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>Votre journée du {today} est enregistrée.</span>
              </div>
            ) : (
              <button
                onClick={onStartWorkday}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg transition-colors shadow-sm"
              >
                <LogIn className="w-4 h-4" />
                <span>Démarrer ma journée</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* === Section 2: Présence de l'équipe === */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-stone-100">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <Users className="w-4 h-4 text-stone-400 shrink-0" />
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-stone-900 truncate">Présence de l'équipe</h3>
                <p className="text-xs text-stone-500 truncate hidden sm:block">Disponibilité en temps réel</p>
              </div>
            </div>

            {/* Compteurs compacts */}
            <div className="flex items-center gap-3 text-xs shrink-0">
              <span className="flex items-center gap-1.5 font-semibold text-emerald-700">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                {onlineCount}
              </span>
              <span className="flex items-center gap-1.5 font-semibold text-amber-700">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                {awayCount}
              </span>
              <span className="flex items-center gap-1.5 font-semibold text-stone-400">
                <span className="w-2 h-2 rounded-full bg-stone-300" />
                {offlineCount}
              </span>
            </div>
          </div>
        </div>

        {/* Grille des membres */}
        <div className="p-3 sm:p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
            {users.map((user) => {
              const isSelf = user.id === currentUser.id;
              const cfg = statusConfig(user.presenceStatus);

              return (
                <div
                  key={user.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                    isSelf ? 'border-brand-light bg-brand-50/30' : 'border-stone-200 bg-white hover:border-stone-300'
                  }`}
                >
                  {/* Avatar avec indicateur de statut */}
                  <div className="relative shrink-0">
                    {user.avatar ? (
                      <img
                        src={user.avatar}
                        alt={user.firstName}
                        className="w-9 h-9 rounded-full object-cover border border-stone-200"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-brand flex items-center justify-center text-white text-xs font-semibold border border-stone-200">
                        {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                      </div>
                    )}
                    <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${cfg.dot}`} />
                  </div>

                  {/* Nom + poste */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-stone-900 truncate">
                        {user.firstName} {user.lastName}
                      </span>
                      {isSelf && (
                        <span className="text-[10px] font-medium text-brand bg-brand-50 px-1.5 py-0.5 rounded shrink-0">
                          Vous
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-stone-500 truncate">{user.jobTitle || 'Membre'}</p>
                  </div>

                  {/* Badge de statut */}
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text} border ${cfg.border} shrink-0`}>
                    {cfg.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* === Section 3: Historique des présences === */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-stone-100">
          <div className="flex items-center gap-2.5">
            <Calendar className="w-4 h-4 text-stone-400 shrink-0" />
            <h3 className="text-sm font-bold text-stone-900">Historique des présences</h3>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[600px]">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-50/80 text-stone-500 font-medium uppercase tracking-wider border-b border-stone-100">
                <tr>
                  <th className="px-4 py-3 font-medium">Employé</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Arrivée</th>
                  <th className="px-4 py-3 font-medium">Départ</th>
                  <th className="px-4 py-3 font-medium">Durée</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {attendanceRecords.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-stone-400">
                      Aucun enregistrement de présence pour le moment.
                    </td>
                  </tr>
                ) : (
                  attendanceRecords.slice().reverse().map((rec) => {
                    const u = users.find((usr) => usr.id === rec.userId);
                    const badge = getStatusBadge(rec.status);

                    return (
                      <tr key={rec.id} className="hover:bg-stone-50/60 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {u?.avatar ? (
                              <img src={u.avatar} alt={u.firstName} className="w-6 h-6 rounded-full object-cover shrink-0" />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-brand flex items-center justify-center text-white text-[10px] font-semibold shrink-0">
                                {u?.firstName.charAt(0)}{u?.lastName.charAt(0)}
                              </div>
                            )}
                            <span className="font-semibold text-stone-900 truncate">
                              {u?.firstName} {u?.lastName}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-stone-600 font-medium">
                          {new Date(rec.date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                        </td>
                        <td className="px-4 py-3 text-stone-700 font-medium">{rec.startTime}</td>
                        <td className="px-4 py-3 text-stone-700 font-medium">{rec.endTime || '—'}</td>
                        <td className="px-4 py-3 text-stone-900 font-semibold">{formatDuration(rec.totalWorkMinutes)}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badge.bg} ${badge.text} ${badge.border}`}>
                            {badge.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
