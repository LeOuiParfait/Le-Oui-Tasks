import React, { useState, useMemo, useEffect } from 'react';
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
  Timer,
  Info,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  FileText,
  Download,
  X,
  Lock
} from 'lucide-react';
import { User, AttendanceRecord, Organization, Task } from '../../types';
import { canViewAllAttendance } from '../../services/permissions';
import { canStartWorkday, isDayCompleted } from '../../services/workSchedule';
import { WorkDayReportModal } from '../reports/WorkDayReportModal';

interface AttendanceViewProps {
  currentUser: User;
  users: User[];
  attendanceRecords: AttendanceRecord[];
  organization: Organization;
  tasks: Task[];
  onStartWorkday: (summary?: string) => void;
  onEndWorkday: (summary?: string) => void;
  onToggleBreak: () => void;
}

const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

export const AttendanceView: React.FC<AttendanceViewProps> = ({
  currentUser,
  users,
  attendanceRecords,
  organization,
  tasks,
  onStartWorkday,
  onEndWorkday,
  onToggleBreak
}) => {
  const today = new Date().toISOString().split('T')[0];
  const myTodayRecord = attendanceRecords.find((r) => r.userId === currentUser.id && r.date === today);

  const isWorking = myTodayRecord && myTodayRecord.status === 'working';
  const isOnBreak = myTodayRecord && myTodayRecord.status === 'on_break';
  const isCompleted = myTodayRecord && myTodayRecord.status === 'completed';

  // Vérifier si on peut pointer (heures de travail)
  const workdayCheck = useMemo(() => canStartWorkday(organization, new Date()), [organization]);
  const dayAlreadyCompleted = useMemo(
    () => isDayCompleted(attendanceRecords, currentUser.id, new Date()),
    [attendanceRecords, currentUser.id]
  );

  // État pour le bilan de fin de journée
  const [showEndDayModal, setShowEndDayModal] = useState(false);
  const [endDaySummary, setEndDaySummary] = useState('');
  const [showRecap, setShowRecap] = useState(false);
  const [showWorkDayReport, setShowWorkDayReport] = useState(false);

  // Afficher le récap automatiquement quand la journée vient d'être terminée
  useEffect(() => {
    if (isCompleted && myTodayRecord?.endTime) {
      setShowRecap(true);
    }
  }, [isCompleted, myTodayRecord?.endTime]);

  // Filtrer les utilisateurs et présences selon les permissions
  const canSeeAll = canViewAllAttendance(currentUser);
  
  const visibleUsers = useMemo(() => {
    if (canSeeAll) return users;
    // User simple : uniquement lui-même
    return users.filter(u => u.id === currentUser.id);
  }, [users, currentUser, canSeeAll]);

  const visibleAttendanceRecords = useMemo(() => {
    if (canSeeAll) return attendanceRecords;
    // User simple : uniquement ses propres présences
    return attendanceRecords.filter(r => r.userId === currentUser.id);
  }, [attendanceRecords, currentUser, canSeeAll]);

  // Filtre par mois
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>('all');

  const filteredByMonth = useMemo(() => {
    return visibleAttendanceRecords.filter(r => {
      const d = new Date(r.date);
      return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
    });
  }, [visibleAttendanceRecords, selectedMonth, selectedYear]);

  const filteredByUser = useMemo(() => {
    if (selectedUserFilter === 'all') return filteredByMonth;
    return filteredByMonth.filter(r => r.userId === selectedUserFilter);
  }, [filteredByMonth, selectedUserFilter]);

  // Statistiques mensuelles
  const monthlyStats = useMemo(() => {
    const records = filteredByMonth;
    const totalDays = records.length;
    const totalWorkMinutes = records.reduce((sum, r) => sum + (r.totalWorkMinutes || 0), 0);
    const totalBreakMinutes = records.reduce((sum, r) => sum + (r.totalBreakMinutes || 0), 0);
    const completedDays = records.filter(r => r.status === 'completed').length;
    const avgWorkPerDay = totalDays > 0 ? Math.round(totalWorkMinutes / totalDays) : 0;

    // Par utilisateur (si admin)
    const byUser: Record<string, { days: number; workMinutes: number; breakMinutes: number }> = {};
    records.forEach(r => {
      if (!byUser[r.userId]) byUser[r.userId] = { days: 0, workMinutes: 0, breakMinutes: 0 };
      byUser[r.userId].days += 1;
      byUser[r.userId].workMinutes += r.totalWorkMinutes || 0;
      byUser[r.userId].breakMinutes += r.totalBreakMinutes || 0;
    });

    return {
      totalDays,
      totalWorkMinutes,
      totalBreakMinutes,
      completedDays,
      avgWorkPerDay,
      byUser
    };
  }, [filteredByMonth]);

  const onlineCount = visibleUsers.filter((u) => u.presenceStatus === 'online').length;
  const awayCount = visibleUsers.filter((u) => u.presenceStatus === 'away').length;
  const offlineCount = visibleUsers.filter((u) => u.presenceStatus === 'offline').length;

  const goToPrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(y => y - 1);
    } else {
      setSelectedMonth(m => m - 1);
    }
  };

  const goToNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(y => y + 1);
    } else {
      setSelectedMonth(m => m + 1);
    }
  };

  const formatDurationLong = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}min`;
    return `${h}h ${m}min`;
  };

  // Export CSV des présences du mois
  const handleExportCSV = () => {
    const records = filteredByMonth;
    if (records.length === 0) return;

    const headers = ['Employé', 'Date', 'Arrivée', 'Départ', 'Temps travaillé', 'Temps pause', 'Statut', 'Bilan'];
    const rows = records.map(rec => {
      const u = visibleUsers.find(usr => usr.id === rec.userId);
      const name = u ? `${u.firstName} ${u.lastName}` : 'Inconnu';
      const workTime = formatDurationLong(rec.totalWorkMinutes || 0);
      const breakTime = formatDurationLong(rec.totalBreakMinutes || 0);
      const statusLabel = rec.status === 'working' ? 'En cours' : rec.status === 'on_break' ? 'En pause' : rec.status === 'completed' ? 'Terminé' : rec.status;
      // Échapper les guillemets pour CSV
      const summary = (rec.summary || '').replace(/"/g, '""');
      return [name, rec.date, rec.startTime || '-', rec.endTime || '-', workTime, breakTime, statusLabel, `"${summary}"`];
    });

    const csvContent = [headers, ...rows]
      .map(row => row.join(','))
      .join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `presences_${MONTH_NAMES[selectedMonth]}_${selectedYear}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

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
                  onClick={() => setShowWorkDayReport(true)}
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
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 text-xs text-stone-500 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>Votre journée du {today} est enregistrée.</span>
                </div>
                <button
                  onClick={() => setShowRecap(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium text-xs rounded-lg transition-colors"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Voir le récap</span>
                </button>
              </div>
            ) : !workdayCheck.canStart ? (
              <div className="flex items-center gap-2 text-xs text-stone-500 font-medium">
                <Lock className="w-4 h-4 text-stone-400" />
                <span>{workdayCheck.reason || 'Pointage indisponible.'}</span>
              </div>
            ) : (
              <button
                onClick={() => onStartWorkday()}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg transition-colors shadow-sm"
              >
                <LogIn className="w-4 h-4" />
                <span>Démarrer ma journée</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* === Modal : Bilan de fin de journée === */}
      {/* === Modal : Bilan de fin de journée (WorkDayReport) === */}
      {showWorkDayReport && (
        <WorkDayReportModal
          currentUser={currentUser}
          tasks={tasks}
          attendanceRecord={myTodayRecord}
          onClose={() => setShowWorkDayReport(false)}
          onSubmitted={() => {
            // Terminer la journée après soumission du bilan
            onEndWorkday('Bilan soumis');
            setShowWorkDayReport(false);
          }}
        />
      )}

      {/* === Modal : Récap de fin de journée === */}
      {showRecap && myTodayRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm" onClick={() => setShowRecap(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <h2 className="font-brand text-lg font-medium text-stone-900">Récap de votre journée</h2>
              </div>
              <button onClick={() => setShowRecap(false)} className="p-1 rounded-lg text-stone-400 hover:text-stone-900 hover:bg-stone-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="text-center py-2">
                <p className="text-xs text-stone-500 uppercase tracking-wider font-semibold mb-1">{myTodayRecord.date}</p>
                <p className="text-3xl font-bold text-brand">{formatDurationLong(myTodayRecord.totalWorkMinutes || 0)}</p>
                <p className="text-xs text-stone-500 mt-1">temps de travail effectif</p>
                {myTodayRecord.timeEstimated && (
                  <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 bg-amber-50 border border-amber-200 rounded-full text-[10px] font-semibold text-amber-700">
                    <AlertCircle className="w-3 h-3" />
                    Temps estimé (inactivité détectée)
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-stone-50 rounded-lg p-3 text-center border border-stone-100">
                  <Clock className="w-4 h-4 text-stone-400 mx-auto mb-1" />
                  <p className="text-[10px] text-stone-500 uppercase">Début</p>
                  <p className="text-sm font-semibold text-stone-900">{myTodayRecord.startTime || '-'}</p>
                </div>
                <div className="bg-stone-50 rounded-lg p-3 text-center border border-stone-100">
                  <LogOut className="w-4 h-4 text-stone-400 mx-auto mb-1" />
                  <p className="text-[10px] text-stone-500 uppercase">Fin</p>
                  <p className="text-sm font-semibold text-stone-900">{myTodayRecord.endTime || '-'}</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-3 text-center border border-amber-100">
                  <Coffee className="w-4 h-4 text-amber-500 mx-auto mb-1" />
                  <p className="text-[10px] text-amber-600 uppercase">Pauses</p>
                  <p className="text-sm font-semibold text-amber-700">{formatDurationLong(myTodayRecord.totalBreakMinutes || 0)}</p>
                </div>
              </div>
              {myTodayRecord.summary && (
                <div className="bg-brand-50 rounded-lg p-3 border border-brand-100">
                  <p className="text-[10px] text-brand-dark uppercase tracking-wider font-semibold mb-1">Votre bilan</p>
                  <p className="text-sm text-stone-700 leading-relaxed">{myTodayRecord.summary}</p>
                </div>
              )}
              <button
                onClick={() => setShowRecap(false)}
                className="w-full px-4 py-2.5 rounded-lg bg-brand hover:bg-brand-dark text-white text-sm font-medium transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* === Section 2: Présence de l'équipe === */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-stone-100">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <Users className="w-4 h-4 text-stone-400 shrink-0" />
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-stone-900 truncate">
                  {canSeeAll ? 'Présence de l\'équipe' : 'Ma Présence'}
                </h3>
                <p className="text-xs text-stone-500 truncate hidden sm:block">
                  {canSeeAll ? 'Disponibilité en temps réel' : 'Votre statut actuel'}
                </p>
              </div>
            </div>

            {/* Compteurs compacts */}
            {canSeeAll && (
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
            )}
          </div>
        </div>

        {/* Grille des membres */}
        <div className="p-3 sm:p-4">
          {!canSeeAll && (
            <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-800">
                Vous voyez uniquement votre propre présence. Contactez votre administrateur pour plus d'accès.
              </p>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
            {visibleUsers.map((user) => {
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

      {/* === Section 3: Statistiques mensuelles === */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-stone-100">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <BarChart3 className="w-4 h-4 text-stone-400 shrink-0" />
              <h3 className="text-sm font-bold text-stone-900">Statistiques mensuelles</h3>
            </div>
            {/* Navigation mois */}
            <div className="flex items-center gap-2">
              <button
                onClick={goToPrevMonth}
                className="p-1 rounded-lg hover:bg-stone-100 text-stone-500 transition-colors"
                title="Mois précédent"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-semibold text-stone-700 min-w-[120px] text-center">
                {MONTH_NAMES[selectedMonth]} {selectedYear}
              </span>
              <button
                onClick={goToNextMonth}
                className="p-1 rounded-lg hover:bg-stone-100 text-stone-500 transition-colors"
                title="Mois suivant"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={handleExportCSV}
                disabled={filteredByMonth.length === 0}
                className="ml-2 flex items-center gap-1.5 px-2.5 py-1 bg-brand hover:bg-brand-dark disabled:opacity-40 disabled:cursor-not-allowed text-white text-[10px] font-semibold rounded-lg transition-colors"
                title="Exporter en CSV"
              >
                <Download className="w-3 h-3" />
                <span>CSV</span>
              </button>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-stone-50 rounded-lg p-3 border border-stone-100">
              <p className="text-[10px] text-stone-500 uppercase tracking-wider font-semibold mb-1">Jours pointés</p>
              <p className="text-xl font-bold text-stone-900">{monthlyStats.totalDays}</p>
            </div>
            <div className="bg-stone-50 rounded-lg p-3 border border-stone-100">
              <p className="text-[10px] text-stone-500 uppercase tracking-wider font-semibold mb-1">Temps travaillé</p>
              <p className="text-xl font-bold text-brand">{formatDurationLong(monthlyStats.totalWorkMinutes)}</p>
            </div>
            <div className="bg-stone-50 rounded-lg p-3 border border-stone-100">
              <p className="text-[10px] text-stone-500 uppercase tracking-wider font-semibold mb-1">Temps en pause</p>
              <p className="text-xl font-bold text-amber-600">{formatDurationLong(monthlyStats.totalBreakMinutes)}</p>
            </div>
            <div className="bg-stone-50 rounded-lg p-3 border border-stone-100">
              <p className="text-[10px] text-stone-500 uppercase tracking-wider font-semibold mb-1">Moyenne / jour</p>
              <p className="text-xl font-bold text-emerald-600">{formatDurationLong(monthlyStats.avgWorkPerDay)}</p>
            </div>
          </div>

          {/* Détail par utilisateur (admin seulement) */}
          {canSeeAll && Object.keys(monthlyStats.byUser).length > 0 && (
            <div className="mt-4 pt-4 border-t border-stone-100">
              <p className="text-[11px] font-semibold text-stone-600 uppercase tracking-wider mb-2">Détail par membre</p>
              <div className="space-y-1.5">
                {Object.entries(monthlyStats.byUser).map(([userId, stats]) => {
                  const u = visibleUsers.find(usr => usr.id === userId);
                  if (!u) return null;
                  return (
                    <div key={userId} className="flex items-center justify-between text-xs py-1.5 px-2 rounded hover:bg-stone-50">
                      <div className="flex items-center gap-2">
                        {u.avatar ? (
                          <img src={u.avatar} alt="" className="w-5 h-5 rounded-full object-cover" />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-brand flex items-center justify-center text-white text-[9px] font-semibold">
                            {u.firstName.charAt(0)}{u.lastName.charAt(0)}
                          </div>
                        )}
                        <span className="font-medium text-stone-700">{u.firstName} {u.lastName}</span>
                      </div>
                      <div className="flex items-center gap-4 text-stone-500">
                        <span>{stats.days}j</span>
                        <span className="font-semibold text-brand">{formatDurationLong(stats.workMinutes)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* === Section 4: Historique des présences === */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-stone-100">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <Calendar className="w-4 h-4 text-stone-400 shrink-0" />
              <h3 className="text-sm font-bold text-stone-900">
                {canSeeAll ? 'Historique des présences' : 'Mon Historique'}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-stone-400">{MONTH_NAMES[selectedMonth]} {selectedYear}</span>
              {canSeeAll && (
                <select
                  value={selectedUserFilter}
                  onChange={(e) => setSelectedUserFilter(e.target.value)}
                  className="text-[10px] border border-stone-200 rounded px-2 py-1 bg-white"
                >
                  <option value="all">Tous les membres</option>
                  {visibleUsers.map(u => (
                    <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                  ))}
                </select>
              )}
            </div>
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
                {filteredByUser.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-stone-400">
                      Aucun enregistrement pour {MONTH_NAMES[selectedMonth]} {selectedYear}.
                    </td>
                  </tr>
                ) : (
                  filteredByUser.slice().reverse().map((rec) => {
                    const u = visibleUsers.find((usr) => usr.id === rec.userId);
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
