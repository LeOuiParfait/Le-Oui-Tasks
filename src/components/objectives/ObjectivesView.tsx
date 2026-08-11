import React, { useState } from 'react';
import { Target, Plus, CheckCircle2, AlertCircle, Clock, TrendingUp } from 'lucide-react';
import { Objective, User, Project } from '../../types';

interface ObjectivesViewProps {
  objectives: Objective[];
  users: User[];
  projects: Project[];
  onUpdateProgress: (objId: string, newValue: number) => void;
  onCreateObjective: (objData: Omit<Objective, 'id' | 'organizationId' | 'createdAt'>) => void;
}

export const ObjectivesView: React.FC<ObjectivesViewProps> = ({
  objectives,
  users,
  projects,
  onUpdateProgress,
  onCreateObjective
}) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetValue, setTargetValue] = useState(100);
  const [unit, setUnit] = useState('%');
  const [deadline, setDeadline] = useState('2026-08-30');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onCreateObjective({
      title: title.trim(),
      description: description.trim(),
      level: 'organization',
      targetValue,
      currentValue: 0,
      unit,
      deadline,
      status: 'on_track',
      linkedTaskIds: []
    });

    setShowCreateModal(false);
    setTitle('');
  };

  return (
    <div className="space-y-4 sm:space-y-6 pb-12 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-stone-900 tracking-tight">Objectifs & OKR</h1>
          <p className="text-xs text-stone-500 mt-0.5">
            Objectifs mesurables de l'entreprise, jalons de projet et résultats clés trimestriels.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-brand hover:bg-brand-dark text-white font-semibold text-xs rounded-xl shadow-xs transition-colors flex items-center space-x-2 shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Nouvel OKR</span>
        </button>
      </div>

      {/* OKR Cards List */}
      <div className="space-y-4">
        {objectives.map((obj) => {
          const progressPct = Math.min(100, Math.round((obj.currentValue / obj.targetValue) * 100));

          return (
            <div key={obj.id} className="bg-white rounded-xl border border-stone-200 p-4 sm:p-6 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 rounded-2xl bg-indigo-50 text-indigo-600 shrink-0">
                    <Target className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                      Niveau : {obj.level}
                    </span>
                    <h3 className="text-base font-bold text-stone-900">{obj.title}</h3>
                  </div>
                </div>

                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-brand-50 text-brand-dark border border-brand-100">
                  Échéance : {obj.deadline}
                </span>
              </div>

              <p className="text-xs text-stone-500 leading-relaxed bg-stone-50/60 rounded-2xl p-3 border border-stone-100">
                {obj.description}
              </p>

              {/* Progress Slider Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-stone-500">
                    Résultat Actuel : {obj.currentValue} / {obj.targetValue} {obj.unit}
                  </span>
                  <span className="text-indigo-600">{progressPct}% Terminé</span>
                </div>
                <div className="w-full bg-stone-100 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-600 h-full rounded-full transition-all duration-500"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>

                {/* Inline Progress Quick Adjuster */}
                <div className="flex items-center space-x-3 pt-2">
                  <span className="text-[11px] font-semibold text-stone-400">Mettre à Jour la Progression :</span>
                  <input
                    type="range"
                    min="0"
                    max={obj.targetValue}
                    value={obj.currentValue}
                    onChange={(e) => onUpdateProgress(obj.id, Number(e.target.value))}
                    className="flex-1 accent-indigo-600"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Form */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full p-4 sm:p-6 space-y-4 shadow-lg">
            <h3 className="text-lg font-bold text-stone-900">Définir un Nouvel Objectif</h3>
            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-stone-700 mb-1">Titre *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="ex. Lancer le bac à sable Midtrans avant le 30 août"
                  className="w-full border border-stone-200 rounded-xl p-2.5 focus:outline-none focus:border-brand-500"
                />
              </div>
              <div>
                <label className="block font-bold text-stone-700 mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full border border-stone-200 rounded-xl p-2.5 focus:outline-none focus:border-brand-500"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-700 mb-1">Valeur Cible</label>
                  <input
                    type="number"
                    value={targetValue}
                    onChange={(e) => setTargetValue(Number(e.target.value))}
                    className="w-full border border-stone-200 rounded-xl p-2.5"
                  />
                </div>
                <div>
                  <label className="block font-bold text-stone-700 mb-1">Unité</label>
                  <input
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full border border-stone-200 rounded-xl p-2.5"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 font-semibold text-stone-600 hover:text-stone-900"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand text-white font-bold rounded-xl hover:bg-brand-dark"
                >
                  Enregistrer l'OKR
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
