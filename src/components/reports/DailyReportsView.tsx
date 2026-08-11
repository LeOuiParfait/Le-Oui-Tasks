import React, { useState } from 'react';
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
  Edit2
} from 'lucide-react';
import { DailyReport, User } from '../../types';

interface DailyReportsViewProps {
  reports: DailyReport[];
  currentUser: User;
  onGenerateReport: () => DailyReport | Promise<DailyReport>;
  onSendReportEmail: (reportId: string) => void;
}

export const DailyReportsView: React.FC<DailyReportsViewProps> = ({
  reports,
  currentUser,
  onGenerateReport,
  onSendReportEmail
}) => {
  const [selectedReport, setSelectedReport] = useState<DailyReport | null>(reports[0] || null);
  const [isSending, setIsSending] = useState(false);
  const [sendNotice, setSendNotice] = useState<string | null>(null);

  const handleGenerateNew = async () => {
    const newRep = await onGenerateReport();
    setSelectedReport(newRep);
  };

  const handleSendEmail = async () => {
    if (!selectedReport) return;
    setIsSending(true);
    setSendNotice(null);

    try {
      const response = await fetch('/api/reports/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportId: selectedReport.id,
          recipients: selectedReport.recipients,
          reportData: selectedReport
        })
      });

      const data = await response.json();
      onSendReportEmail(selectedReport.id);
      setIsSending(false);
      setSendNotice(data.message || 'Report email successfully dispatched!');
    } catch (err: any) {
      setIsSending(false);
      setSendNotice('Failed to dispatch report. Checked network connectivity.');
    }
  };

  const activeReport = selectedReport || reports[0];

  return (
    <div className="space-y-4 sm:space-y-6 pb-12 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-stone-900 tracking-tight">Rapports Quotidiens de l'Équipe</h1>
          <p className="text-xs text-stone-500 mt-0.5">
            Résumés quotidiens automatisés agrégeant présence, tâches, blocages et progression des projets.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={handleGenerateNew}
            className="px-4 py-2.5 bg-brand hover:bg-brand-dark text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center space-x-2"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Générer le Rapport du Jour</span>
          </button>
        </div>
      </div>

      {/* Main Layout: History Sidebar + Report View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Left Col: Historical Reports List */}
        <div className="bg-white rounded-xl border border-stone-200 p-5 shadow-xs h-fit space-y-3">
          <h3 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-2">Historique des Rapports</h3>
          <div className="space-y-2">
            {reports.map((rep) => {
              const isSelected = activeReport?.id === rep.id;
              return (
                <div
                  key={rep.id}
                  onClick={() => setSelectedReport(rep)}
                  className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-brand-50/80 border-brand-light shadow-sm'
                      : 'bg-white border-stone-200 hover:bg-stone-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs text-stone-900">{rep.date}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        rep.status === 'sent'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {rep.status === 'sent' ? 'Envoyé' : 'Brouillon'}
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-500 truncate">Par : {rep.generatedBy}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right 2 Cols: Report Content Document Preview */}
        {activeReport ? (
          <div className="lg:col-span-2 bg-white rounded-xl border border-stone-200 p-4 sm:p-8 shadow-xs space-y-4 sm:space-y-6">
            {/* Action Bar */}
            <div className="flex items-center justify-between pb-4 border-b border-stone-100">
              <div>
                <span className="text-xs font-bold text-brand uppercase tracking-wider block">
                  RAPPORT QUOTIDIEN DE L'ÉQUIPE
                </span>
                <h2 className="text-lg sm:text-xl font-bold text-stone-900">{activeReport.date}</h2>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => window.print()}
                  className="p-2 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition-colors"
                  title="Imprimer / Exporter en PDF"
                >
                  <Printer className="w-4 h-4" />
                </button>
                <button
                  onClick={handleSendEmail}
                  disabled={isSending}
                  className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs rounded-xl transition-colors flex items-center space-x-2 shadow-xs"
                >
                  <Mail className="w-4 h-4" />
                  <span>{isSending ? 'Envoi en cours...' : 'Envoyer par E-mail'}</span>
                </button>
              </div>
            </div>

            {sendNotice && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl text-xs font-semibold">
                {sendNotice}
              </div>
            )}

            {/* Attendance Summary */}
            <div className="grid grid-cols-3 gap-2 sm:gap-4 bg-stone-50 rounded-2xl p-3 sm:p-4 border border-stone-100 text-center">
              <div>
                <span className="text-[10px] font-bold text-stone-400 uppercase">Prévus</span>
                <p className="text-lg font-bold text-stone-900">{activeReport.attendanceSummary.expected}</p>
              </div>
              <div>
                <span className="text-[10px] font-bold text-stone-400 uppercase">Présents Aujourd'hui</span>
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
                <div className="p-3 bg-brand-50 border border-brand-100 rounded-xl text-blue-900">
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
          </div>
        ) : (
          <div className="lg:col-span-2 bg-white rounded-xl border border-stone-200 p-12 text-center text-stone-400 text-xs">
            Aucun rapport sélectionné. Cliquez sur "Générer le Rapport du Jour" pour créer un nouveau résumé.
          </div>
        )}
      </div>
    </div>
  );
};
