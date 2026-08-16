'use client'

import React, { useState, useMemo } from 'react';
import {
  FileText,
  Send,
  Printer,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Users,
  Clock,
  Mail,
  Edit2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Loader2,
  Filter,
  Trash2,
  User as UserIcon
} from 'lucide-react';
import { DailyReport, User, WorkDayReport } from '@/types';
import { store } from '@/lib/services/store';

interface DailyReportsViewProps {
  reports: DailyReport[];
  workDayReports: WorkDayReport[];
  users: User[];
  currentUser: User;
  onGenerateReport: () => DailyReport | Promise<DailyReport>;
  onSendReportEmail: (reportId: string) => void;
}

const MONTH_NAMES = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

export const DailyReportsView: React.FC<DailyReportsViewProps> = ({
  reports,
  workDayReports,
  users,
  currentUser,
  onGenerateReport,
  onSendReportEmail
}) => {
  const [selectedReport, setSelectedReport] = useState<DailyReport | null>(reports[0] || null);
  const [isSending, setIsSending] = useState(false);
  const [sendNotice, setSendNotice] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'draft' | 'sent'>('all');
  const [deletingReportId, setDeletingReportId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'team' | 'individual'>('team');
  const [selectedWorkDayReport, setSelectedWorkDayReport] = useState<WorkDayReport | null>(null);
  const [submittingWdrId, setSubmittingWdrId] = useState<string | null>(null);
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  const handleGenerateNew = async () => {
    const newRep = await onGenerateReport();
    setSelectedReport(newRep);
  };

  const handleDeleteReport = async (e: React.MouseEvent, reportId: string) => {
    e.stopPropagation();
    setDeletingReportId(reportId);
    try {
      await store.deleteReport(reportId);
      if (selectedReport?.id === reportId) setSelectedReport(null);
    } finally {
      setDeletingReportId(null);
    }
  };

  const handleSubmitWorkDayReport = async (e: React.MouseEvent, wdr: WorkDayReport) => {
    e.stopPropagation();
    setSubmittingWdrId(wdr.id);
    try {
      await store.submitWorkDayReport(wdr);
    } finally {
      setSubmittingWdrId(null);
    }
  };

  const handleSendEmail = async (report?: DailyReport) => {
    const rep = report || selectedReport;
    if (!rep) return;
    setIsSending(true);
    setSendNotice(null);

    try {
      await onSendReportEmail(rep.id);
      setIsSending(false);
      setSendNotice('Rapport envoyé avec succès !');
      setTimeout(() => setSendNotice(null), 4000);
    } catch (err: any) {
      setIsSending(false);
      setSendNotice(err.message || 'Échec de l\'envoi. Vérifiez la configuration e-mail.');
      setTimeout(() => setSendNotice(null), 6000);
    }
  };

  // Filtrer par mois et statut
  const filteredReports = useMemo(() => {
    return reports.filter(r => {
      const d = new Date(r.date);
      const monthMatch = d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
      const statusMatch = statusFilter === 'all' || r.status === statusFilter;
      return monthMatch && statusMatch;
    });
  }, [reports, selectedMonth, selectedYear, statusFilter]);

  const activeReport = filteredReports.find(r => r.id === selectedReport?.id) || filteredReports[0] || null;

  const goToPrevMonth = () => {
    if (selectedMonth === 0) { setSelectedMonth(11); setSelectedYear(y => y - 1); }
    else setSelectedMonth(m => m - 1);
  };
  const goToNextMonth = () => {
    if (selectedMonth === 11) { setSelectedMonth(0); setSelectedYear(y => y + 1); }
    else setSelectedMonth(m => m + 1);
  };

  const draftCount = reports.filter(r => r.status === 'draft').length;
  const sentCount = reports.filter(r => r.status === 'sent').length;

  // Filtrer les bilans individuels par mois
  const filteredWorkDayReports = useMemo(() => {
    return workDayReports.filter(r => {
      const d = new Date(r.date);
      return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
    });
  }, [workDayReports, selectedMonth, selectedYear]);

  const getUser = (userId: string) => users.find(u => u.id === userId);

  return (
    <div className="space-y-4 sm:space-y-6 pb-12 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-stone-900 tracking-tight">Rapports Quotidiens</h1>
          <p className="text-xs text-stone-500 mt-0.5">
            Résumés quotidiens agrégeant présence, tâches, blocages et progression.
          </p>
        </div>
        <button
          onClick={handleGenerateNew}
          className="px-4 py-2.5 bg-brand hover:bg-brand-dark text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center space-x-2"
        >
          <Sparkles className="w-4 h-4 text-amber-300" />
          <span>Générer le Rapport du Jour</span>
        </button>
      </div>

      {/* Onglets : Rapports d'équipe / Bilans individuels */}
      <div className="flex items-center gap-1 border-b border-stone-200">
        <button
          onClick={() => setActiveTab('team')}
          className={`px-4 py-2.5 font-semibold text-xs border-b-2 transition-colors ${
            activeTab === 'team' ? 'border-brand text-brand' : 'border-transparent text-stone-500 hover:text-stone-900'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            Rapports d'équipe
          </span>
        </button>
        <button
          onClick={() => setActiveTab('individual')}
          className={`px-4 py-2.5 font-semibold text-xs border-b-2 transition-colors ${
            activeTab === 'individual' ? 'border-brand text-brand' : 'border-transparent text-stone-500 hover:text-stone-900'
          }`}
        >
          <span className="flex items-center gap-1.5">
            <UserIcon className="w-3.5 h-3.5" />
            Bilans individuels ({filteredWorkDayReports.length})
          </span>
        </button>
      </div>

      {/* Stats rapides */}
      {activeTab === 'team' && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl border border-stone-200 p-3 text-center">
            <p className="text-2xl font-bold text-stone-900">{reports.length}</p>
            <p className="text-[10px] text-stone-500 uppercase tracking-wider font-semibold">Total rapports</p>
          </div>
          <div className="bg-white rounded-xl border border-stone-200 p-3 text-center">
            <p className="text-2xl font-bold text-emerald-600">{sentCount}</p>
            <p className="text-[10px] text-stone-500 uppercase tracking-wider font-semibold">Envoyés</p>
          </div>
          <div className="bg-white rounded-xl border border-stone-200 p-3 text-center">
            <p className="text-2xl font-bold text-amber-600">{draftCount}</p>
            <p className="text-[10px] text-stone-500 uppercase tracking-wider font-semibold">Brouillons</p>
          </div>
        </div>
      )}

      {/* === Onglet Bilans individuels === */}
      {activeTab === 'individual' && (
        <div className="space-y-4">
          {/* Navigation mois */}
          <div className="flex items-center justify-between bg-white rounded-xl border border-stone-200 p-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-stone-400" />
              <span className="text-xs font-semibold text-stone-700">
                {MONTH_NAMES[selectedMonth]} {selectedYear}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={goToPrevMonth} className="p-1 rounded hover:bg-stone-100 text-stone-500 transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={goToNextMonth} className="p-1 rounded hover:bg-stone-100 text-stone-500 transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Liste des bilans individuels */}
          {filteredWorkDayReports.length === 0 ? (
            <div className="bg-white rounded-xl border border-stone-200 p-12 text-center text-stone-400 text-xs">
              Aucun bilan individuel pour {MONTH_NAMES[selectedMonth]} {selectedYear}.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredWorkDayReports
                .slice()
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((wdr) => {
                  const u = getUser(wdr.userId);
                  const isSelected = selectedWorkDayReport?.id === wdr.id;
                  return (
                    <div
                      key={wdr.id}
                      onClick={() => setSelectedWorkDayReport(isSelected ? null : wdr)}
                      className={`bg-white rounded-xl border p-4 cursor-pointer transition-all ${
                        isSelected ? 'border-brand shadow-sm' : 'border-stone-200 hover:border-stone-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {u?.avatar ? (
                            <img src={u.avatar} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center text-white text-xs font-semibold shrink-0">
                              {u ? `${u.firstName.charAt(0)}${u.lastName.charAt(0)}` : '?'}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-stone-900 truncate">
                              {u ? `${u.firstName} ${u.lastName}` : 'Inconnu'}
                            </p>
                            <p className="text-[11px] text-stone-500">{wdr.date}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {wdr.status === 'draft' && (
                            <button
                              onClick={(e) => handleSubmitWorkDayReport(e, wdr)}
                              disabled={submittingWdrId === wdr.id}
                              className="flex items-center gap-1 px-2 py-1 rounded-full bg-brand text-white text-[10px] font-semibold hover:bg-brand-dark disabled:opacity-50 transition-colors"
                            >
                              {submittingWdrId === wdr.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                              Envoyer
                            </button>
                          )}
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            wdr.status === 'submitted'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}>
                            {wdr.status === 'submitted' ? 'Soumis' : 'Brouillon'}
                          </span>
                        </div>
                      </div>
                      {wdr.summary && (
                        <p className="text-xs text-stone-600 line-clamp-2 mb-2">{wdr.summary}</p>
                      )}
                      {wdr.tasksWorkedOn.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {wdr.tasksWorkedOn.slice(0, 3).map((t, i) => (
                            <span key={i} className="text-[10px] text-stone-500 bg-stone-100 px-1.5 py-0.5 rounded">
                              {t.taskTitle}
                            </span>
                          ))}
                          {wdr.tasksWorkedOn.length > 3 && (
                            <span className="text-[10px] text-stone-400">+{wdr.tasksWorkedOn.length - 3}</span>
                          )}
                        </div>
                      )}

                      {/* Détail expansé */}
                      {isSelected && (
                        <div className="mt-4 pt-4 border-t border-stone-100 space-y-3">
                          {wdr.achievements && (
                            <div>
                              <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider mb-1">Accompli</p>
                              <p className="text-xs text-stone-700">{wdr.achievements}</p>
                            </div>
                          )}
                          {wdr.challenges && (
                            <div>
                              <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider mb-1">Difficultés</p>
                              <p className="text-xs text-stone-700">{wdr.challenges}</p>
                            </div>
                          )}
                          {wdr.planTomorrow && (
                            <div>
                              <p className="text-[10px] font-semibold text-brand uppercase tracking-wider mb-1">Plan demain</p>
                              <p className="text-xs text-stone-700">{wdr.planTomorrow}</p>
                            </div>
                          )}
                          {wdr.tasksWorkedOn.length > 0 && (
                            <div>
                              <p className="text-[10px] font-semibold text-stone-500 uppercase tracking-wider mb-1">Tâches</p>
                              <div className="space-y-1">
                                {wdr.tasksWorkedOn.map((t, i) => (
                                  <div key={i} className="text-xs text-stone-700 bg-stone-50 rounded p-2">
                                    <p className="font-medium">{t.taskTitle}</p>
                                    {t.progressNote && <p className="text-stone-500 mt-0.5">{t.progressNote}</p>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          <div className="flex items-center gap-4 text-[10px] text-stone-400 pt-2">
                            <span>Travail : {Math.floor(wdr.workMinutes / 60)}h{wdr.workMinutes % 60}min</span>
                            <span>Pause : {Math.floor(wdr.breakMinutes / 60)}h{wdr.breakMinutes % 60}min</span>
                            {wdr.startTime && <span>Début : {wdr.startTime}</span>}
                            {wdr.endTime && <span>Fin : {wdr.endTime}</span>}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* === Onglet Rapports d'équipe === */}
      {activeTab === 'team' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Left: Historical Reports List */}
          <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-xs h-fit space-y-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-stone-400 uppercase tracking-wider">Historique</h3>
              <div className="flex items-center gap-1">
                <button onClick={goToPrevMonth} className="p-1 rounded hover:bg-stone-100 text-stone-500 transition-colors">
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="text-[10px] font-semibold text-stone-700 min-w-[80px] text-center">
                  {MONTH_NAMES[selectedMonth].slice(0, 3)} {selectedYear}
                </span>
                <button onClick={goToNextMonth} className="p-1 rounded hover:bg-stone-100 text-stone-500 transition-colors">
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1 mb-3">
              <Filter className="w-3 h-3 text-stone-400" />
              {(['all', 'draft', 'sent'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`text-[10px] px-2 py-1 rounded font-medium transition-colors ${
                    statusFilter === s ? 'bg-brand text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                  }`}
                >
                  {s === 'all' ? 'Tous' : s === 'draft' ? 'Brouillons' : 'Envoyés'}
                </button>
              ))}
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredReports.length === 0 ? (
                <p className="text-xs text-stone-400 text-center py-6">
                  Aucun rapport pour {MONTH_NAMES[selectedMonth]} {selectedYear}.
                </p>
              ) : (
                filteredReports.map((rep) => {
                  const isSelected = activeReport?.id === rep.id;
                  return (
                    <div
                      key={rep.id}
                      onClick={() => setSelectedReport(rep)}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-brand-50/80 border-brand-light shadow-sm'
                          : 'bg-white border-stone-200 hover:bg-stone-50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-xs text-stone-900">{rep.date}</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => handleDeleteReport(e, rep.id)}
                            disabled={deletingReportId === rep.id}
                            className="p-1 rounded text-stone-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-50 transition-colors"
                            title="Supprimer"
                          >
                            {deletingReportId === rep.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                              rep.status === 'sent'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {rep.status === 'sent' && <CheckCircle2 className="w-2.5 h-2.5" />}
                            {rep.status === 'sent' ? 'Envoyé' : 'Brouillon'}
                          </span>
                        </div>
                      </div>
                      <p className="text-[11px] text-stone-500 truncate">Par : {rep.generatedBy}</p>
                      {rep.status === 'sent' && rep.sentAt && (
                        <p className="text-[10px] text-emerald-600 truncate mt-0.5">
                          Envoyé le {new Date(rep.sentAt).toLocaleDateString('fr-FR')} à {new Date(rep.sentAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: Report Content */}
          {activeReport ? (
            <div className="lg:col-span-2 bg-white rounded-xl border border-stone-200 p-4 sm:p-8 shadow-xs space-y-4 sm:space-y-6">
              {/* Action Bar */}
              <div className="flex items-center justify-between pb-4 border-b border-stone-100">
                <div>
                  <span className="text-xs font-bold text-brand uppercase tracking-wider block">
                    RAPPORT QUOTIDIEN
                  </span>
                  <h2 className="text-lg sm:text-xl font-bold text-stone-900">{activeReport.date}</h2>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    Généré par <strong>{activeReport.generatedBy}</strong>
                    {activeReport.status === 'sent' && activeReport.sentAt && (
                      <span className="text-emerald-600"> • Envoyé le {new Date(activeReport.sentAt).toLocaleDateString('fr-FR')} à {new Date(activeReport.sentAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                    )}
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => window.print()}
                    className="p-2 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition-colors"
                    title="Imprimer / Exporter en PDF"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                  {activeReport.status === 'sent' ? (
                    <button
                      onClick={() => handleSendEmail(activeReport)}
                      disabled={isSending}
                    className="px-4 py-2 bg-stone-200 hover:bg-stone-300 text-stone-700 font-bold text-xs rounded-xl transition-colors flex items-center space-x-2"
                    title="Renvoyer le rapport"
                  >
                    {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCw className="w-4 h-4" />}
                    <span>{isSending ? 'Envoi...' : 'Renvoyer'}</span>
                  </button>
                ) : (
                  <button
                    onClick={() => handleSendEmail(activeReport)}
                    disabled={isSending}
                    className="px-4 py-2 bg-brand hover:bg-brand-dark text-white font-bold text-xs rounded-xl transition-colors flex items-center space-x-2 shadow-xs"
                  >
                    {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                    <span>{isSending ? 'Envoi...' : 'Envoyer'}</span>
                  </button>
                )}
              </div>
            </div>

            {sendNotice && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl text-xs font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                {sendNotice}
              </div>
            )}

            {/* Statut du rapport */}
            <div className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-semibold ${
              activeReport.status === 'sent'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}>
              {activeReport.status === 'sent'
                ? <><CheckCircle2 className="w-4 h-4" /> Rapport envoyé aux destinataires</>
                : <><Edit2 className="w-4 h-4" /> Brouillon — non encore envoyé</>
              }
              <span className="text-stone-400 ml-auto">{activeReport.recipients.length} destinataire(s)</span>
            </div>

            {/* Attendance Summary */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4 bg-stone-50 rounded-2xl p-3 sm:p-4 border border-stone-100 text-center">
              <div>
                <span className="text-[10px] font-bold text-stone-400 uppercase">Prévus</span>
                <p className="text-lg font-bold text-stone-900">{activeReport.attendanceSummary.expected}</p>
              </div>
              <div>
                <span className="text-[10px] font-bold text-stone-400 uppercase">Présents</span>
                <p className="text-lg font-bold text-emerald-600">{activeReport.attendanceSummary.present}</p>
              </div>
              <div>
                <span className="text-[10px] font-bold text-stone-400 uppercase">Absences</span>
                <p className="text-lg font-bold text-stone-500">{activeReport.attendanceSummary.absent}</p>
              </div>
            </div>

            {/* Task Velocity Metrics */}
            <div>
              <h4 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-3">
                Répartition des Tâches
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-900">
                  <span className="font-bold text-base block">{activeReport.tasksSummary.completed}</span>
                  <span>Terminées</span>
                </div>
                <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-amber-900">
                  <span className="font-bold text-base block">{activeReport.tasksSummary.inProgress}</span>
                  <span>En cours</span>
                </div>
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-900">
                  <span className="font-bold text-base block">{activeReport.tasksSummary.blocked}</span>
                  <span>Bloquées</span>
                </div>
                <div className="p-3 bg-brand-50 border border-brand-100 rounded-xl text-brand-dark">
                  <span className="font-bold text-base block">{activeReport.tasksSummary.inReview}</span>
                  <span>En révision</span>
                </div>
              </div>
            </div>

            {/* Active Blockers */}
            <div>
              <h4 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-3">
                Blocages Techniques Actifs
              </h4>
              {activeReport.blockers.length > 0 ? (
                <div className="space-y-2">
                  {activeReport.blockers.map((b, i) => (
                    <div key={i} className="p-3 bg-rose-50/80 border border-rose-200/80 rounded-xl text-xs space-y-1">
                      <div className="flex justify-between font-bold text-rose-900">
                        <span>{b.taskTitle}</span>
                        <span>Assigné : {b.assigneeName}</span>
                      </div>
                      <p className="text-rose-700">{b.reason}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-stone-500 italic bg-stone-50 p-3 rounded-xl">
                  Aucun blocage actif signalé aujourd'hui.
                </p>
              )}
            </div>

            {/* Tomorrow's Priorities */}
            <div>
              <h4 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-3">
                Priorités Clés pour Demain
              </h4>
              <ul className="space-y-2">
                {activeReport.prioritiesTomorrow.map((p, i) => (
                  <li key={i} className="flex items-center space-x-2 text-xs font-medium text-stone-800 bg-stone-50 p-2.5 rounded-xl border border-stone-100">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand shrink-0" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Tâches terminées aujourd'hui */}
            {activeReport.completedToday && activeReport.completedToday.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-3">
                  Tâches Terminées Aujourd'hui
                </h4>
                <div className="space-y-2">
                  {activeReport.completedToday.map((t, i) => (
                    <div key={i} className="p-3 bg-emerald-50/80 border border-emerald-100 rounded-xl text-xs flex items-center justify-between">
                      <span className="font-medium text-emerald-900">{t.title}</span>
                      <span className="text-[10px] text-emerald-700">{t.projectName}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tâches en cours */}
            {activeReport.inProgressToday && activeReport.inProgressToday.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-3">
                  Tâches en Cours
                </h4>
                <div className="space-y-2">
                  {activeReport.inProgressToday.map((t, i) => (
                    <div key={i} className="p-3 bg-amber-50/80 border border-amber-100 rounded-xl text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="font-medium text-amber-900">{t.title}</span>
                        <span className="text-[10px] text-amber-700">{t.projectName}</span>
                      </div>
                      <p className="text-[10px] text-amber-800">Assigné : {t.assigneeName}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Présences détaillées */}
            {activeReport.attendanceDetails && activeReport.attendanceDetails.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-3">
                  Présences du Jour
                </h4>
                <div className="space-y-2">
                  {activeReport.attendanceDetails.map((a, i) => (
                    <div key={i} className="p-3 bg-stone-50 border border-stone-100 rounded-xl text-xs flex items-center justify-between">
                      <span className="font-medium text-stone-900">{a.name}</span>
                      <div className="flex items-center gap-3 text-[10px] text-stone-500">
                        <span className="capitalize">{a.status.replace('_', ' ')}</span>
                        <span className="font-semibold text-brand">{Math.floor(a.workMinutes / 60)}h{a.workMinutes % 60}min</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bilans individuels du jour */}
            {activeReport.workDaySummaries && activeReport.workDaySummaries.length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-3">
                  Bilans Individuels Soumis
                </h4>
                <div className="space-y-2">
                  {activeReport.workDaySummaries.map((s, i) => (
                    <div key={i} className="p-3 bg-brand-50/40 border border-brand-100 rounded-xl text-xs">
                      <p className="font-semibold text-brand-dark mb-1">{s.name}</p>
                      <p className="text-stone-700 line-clamp-3">{s.summary}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Destinataires */}
            <div className="pt-4 border-t border-stone-100">
              <h4 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-2">
                Destinataires ({activeReport.recipients.length})
              </h4>
              <div className="flex flex-wrap gap-2">
                {activeReport.recipients.map((email, i) => (
                  <span key={i} className="text-[11px] text-stone-600 bg-stone-100 px-2 py-1 rounded-lg flex items-center gap-1">
                    <Mail className="w-3 h-3 text-stone-400" />
                    {email}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="lg:col-span-2 bg-white rounded-xl border border-stone-200 p-12 text-center text-stone-400 text-xs">
            Aucun rapport sélectionné. Cliquez sur "Générer le Rapport du Jour" pour créer un nouveau résumé.
          </div>
        )}
        </div>
      )}
    </div>
  );
};
