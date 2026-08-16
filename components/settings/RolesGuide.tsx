'use client'

import React, { useState } from 'react';
import { 
  Shield, 
  Users, 
  User, 
  Eye, 
  CheckCircle2, 
  XCircle, 
  ChevronDown,
  ChevronUp,
  Info,
  AlertTriangle,
  Lightbulb
} from 'lucide-react';
import { UserRole } from '@/types';

export const RolesGuide: React.FC = () => {
  const [expandedRole, setExpandedRole] = useState<UserRole | null>('super_admin');

  const roles: Array<{
    role: UserRole;
    name: string;
    icon: React.ReactNode;
    color: string;
    description: string;
    useCases: string[];
    permissions: {
      category: string;
      items: Array<{ action: string; allowed: boolean }>;
    }[];
  }> = [
    {
      role: 'super_admin',
      name: 'Super Administrateur',
      icon: <Shield className="w-5 h-5" />,
      color: 'purple',
      description: 'Propriétaire de l\'organisation. Accès total et illimité à toutes les fonctionnalités.',
      useCases: [
        'Fondateur / Directeur Général',
        'Propriétaire de l\'entreprise',
        'Personne ayant créé l\'organisation'
      ],
      permissions: [
        {
          category: 'Organisation',
          items: [
            { action: 'Modifier les paramètres de l\'organisation', allowed: true },
            { action: 'Inviter et supprimer des membres', allowed: true },
            { action: 'Changer tous les rôles (y compris super_admin)', allowed: true },
            { action: 'Voir toutes les données de l\'organisation', allowed: true }
          ]
        },
        {
          category: 'Équipes & Projets',
          items: [
            { action: 'Créer, modifier, supprimer des équipes', allowed: true },
            { action: 'Créer, modifier, supprimer des projets', allowed: true },
            { action: 'Voir tous les projets et équipes', allowed: true }
          ]
        },
        {
          category: 'Tâches',
          items: [
            { action: 'Voir toutes les tâches', allowed: true },
            { action: 'Créer, assigner, modifier, supprimer des tâches', allowed: true },
            { action: 'Valider les tâches', allowed: true }
          ]
        },
        {
          category: 'Présences & Rapports',
          items: [
            { action: 'Voir toutes les présences', allowed: true },
            { action: 'Générer tous les rapports', allowed: true },
            { action: 'Voir toute l\'analytique', allowed: true }
          ]
        }
      ]
    },
    {
      role: 'admin',
      name: 'Administrateur',
      icon: <Shield className="w-5 h-5" />,
      color: 'blue',
      description: 'Gère les équipes, projets et utilisateurs. Ne peut pas modifier les paramètres critiques de l\'organisation.',
      useCases: [
        'Directeur des Opérations',
        'Responsable RH',
        'Bras droit du fondateur'
      ],
      permissions: [
        {
          category: 'Organisation',
          items: [
            { action: 'Modifier les paramètres de l\'organisation', allowed: false },
            { action: 'Inviter et supprimer des membres', allowed: true },
            { action: 'Changer les rôles (sauf super_admin)', allowed: true },
            { action: 'Voir toutes les données', allowed: true }
          ]
        },
        {
          category: 'Équipes & Projets',
          items: [
            { action: 'Créer, modifier, supprimer des équipes', allowed: true },
            { action: 'Créer, modifier, supprimer des projets', allowed: true },
            { action: 'Voir tous les projets et équipes', allowed: true }
          ]
        },
        {
          category: 'Tâches',
          items: [
            { action: 'Voir toutes les tâches', allowed: true },
            { action: 'Créer, assigner, modifier, supprimer des tâches', allowed: true },
            { action: 'Valider les tâches', allowed: true }
          ]
        },
        {
          category: 'Présences & Rapports',
          items: [
            { action: 'Voir toutes les présences', allowed: true },
            { action: 'Générer tous les rapports', allowed: true },
            { action: 'Voir toute l\'analytique', allowed: true }
          ]
        }
      ]
    },
    {
      role: 'manager',
      name: 'Manager / Chef de Projet',
      icon: <Users className="w-5 h-5" />,
      color: 'emerald',
      description: 'Peut créer des projets, gérer ses équipes, voir les présences de ses équipes et générer des rapports pour ses projets.',
      useCases: [
        'Chef de Projet',
        'Product Manager',
        'Responsable d\'équipe avec plusieurs projets'
      ],
      permissions: [
        {
          category: 'Organisation',
          items: [
            { action: 'Modifier les paramètres de l\'organisation', allowed: false },
            { action: 'Inviter des membres', allowed: true },
            { action: 'Supprimer des membres', allowed: false },
            { action: 'Changer les rôles', allowed: false }
          ]
        },
        {
          category: 'Équipes & Projets',
          items: [
            { action: 'Créer des équipes et projets', allowed: true },
            { action: 'Modifier ses équipes et projets', allowed: true },
            { action: 'Supprimer des équipes/projets', allowed: false },
            { action: 'Voir uniquement ses projets', allowed: true }
          ]
        },
        {
          category: 'Tâches',
          items: [
            { action: 'Voir les tâches de ses projets uniquement', allowed: true },
            { action: 'Créer et assigner des tâches dans ses projets', allowed: true },
            { action: 'Valider les tâches de ses projets', allowed: true }
          ]
        },
        {
          category: 'Présences & Rapports',
          items: [
            { action: 'Voir les présences de ses équipes/projets', allowed: true },
            { action: 'Générer des rapports pour ses projets', allowed: true },
            { action: 'Voir l\'analytique de ses projets', allowed: true }
          ]
        }
      ]
    },
    {
      role: 'team_lead',
      name: 'Chef d\'Équipe',
      icon: <Users className="w-5 h-5" />,
      color: 'amber',
      description: 'Gère son équipe (assigner tâches, voir présences), mais ne peut pas créer de projets.',
      useCases: [
        'Scrum Master',
        'Lead Developer',
        'Chef d\'équipe technique'
      ],
      permissions: [
        {
          category: 'Organisation',
          items: [
            { action: 'Modifier les paramètres de l\'organisation', allowed: false },
            { action: 'Inviter des membres', allowed: false },
            { action: 'Supprimer des membres', allowed: false },
            { action: 'Changer les rôles', allowed: false }
          ]
        },
        {
          category: 'Équipes & Projets',
          items: [
            { action: 'Créer des projets', allowed: false },
            { action: 'Modifier son équipe', allowed: true },
            { action: 'Voir uniquement ses projets', allowed: true }
          ]
        },
        {
          category: 'Tâches',
          items: [
            { action: 'Voir les tâches de ses projets', allowed: true },
            { action: 'Créer et assigner des tâches dans ses projets', allowed: true },
            { action: 'Valider les tâches de son équipe', allowed: true }
          ]
        },
        {
          category: 'Présences & Rapports',
          items: [
            { action: 'Voir les présences de son équipe', allowed: true },
            { action: 'Générer des rapports pour son équipe', allowed: true },
            { action: 'Voir l\'analytique de son équipe', allowed: true }
          ]
        }
      ]
    },
    {
      role: 'user',
      name: 'Utilisateur',
      icon: <User className="w-5 h-5" />,
      color: 'stone',
      description: 'Utilisateur standard. Voit uniquement ses tâches, ses projets et sa présence.',
      useCases: [
        'Développeur',
        'Designer',
        'QA Tester',
        'Tout membre de l\'équipe sans responsabilités de gestion'
      ],
      permissions: [
        {
          category: 'Organisation',
          items: [
            { action: 'Modifier les paramètres', allowed: false },
            { action: 'Inviter des membres', allowed: false },
            { action: 'Voir uniquement son profil', allowed: true }
          ]
        },
        {
          category: 'Équipes & Projets',
          items: [
            { action: 'Créer des projets', allowed: false },
            { action: 'Voir uniquement ses projets (lecture seule)', allowed: true }
          ]
        },
        {
          category: 'Tâches',
          items: [
            { action: 'Voir UNIQUEMENT les tâches qui lui sont assignées', allowed: true },
            { action: 'Créer des tâches dans ses projets', allowed: true },
            { action: 'Modifier ses propres tâches', allowed: true },
            { action: 'Assigner des tâches', allowed: false }
          ]
        },
        {
          category: 'Présences & Rapports',
          items: [
            { action: 'Voir UNIQUEMENT sa propre présence', allowed: true },
            { action: 'Pointer (démarrer/pause/fin de journée)', allowed: true },
            { action: 'Générer des rapports', allowed: false },
            { action: 'Voir l\'analytique', allowed: false }
          ]
        }
      ]
    },
    {
      role: 'viewer',
      name: 'Observateur',
      icon: <Eye className="w-5 h-5" />,
      color: 'slate',
      description: 'Lecture seule sur les projets auxquels il est invité. Ne peut rien modifier.',
      useCases: [
        'Client externe',
        'Stakeholder',
        'Investisseur',
        'Consultant externe'
      ],
      permissions: [
        {
          category: 'Organisation',
          items: [
            { action: 'Modifier quoi que ce soit', allowed: false },
            { action: 'Voir uniquement son profil', allowed: true }
          ]
        },
        {
          category: 'Équipes & Projets',
          items: [
            { action: 'Voir uniquement les projets où il est invité', allowed: true },
            { action: 'Modifier des projets', allowed: false }
          ]
        },
        {
          category: 'Tâches',
          items: [
            { action: 'Voir les tâches des projets où il est invité', allowed: true },
            { action: 'Créer ou modifier des tâches', allowed: false }
          ]
        },
        {
          category: 'Présences & Rapports',
          items: [
            { action: 'Voir les présences', allowed: false },
            { action: 'Pointer', allowed: false },
            { action: 'Voir les rapports', allowed: false }
          ]
        }
      ]
    }
  ];

  const getRoleColor = (color: string) => {
    const colors: Record<string, { bg: string; text: string; border: string }> = {
      purple: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
      blue: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
      emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
      amber: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
      stone: { bg: 'bg-stone-50', text: 'text-stone-700', border: 'border-stone-200' },
      slate: { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' }
    };
    return colors[color] || colors.stone;
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-brand to-brand-dark text-white rounded-xl p-6 shadow-lg">
        <div className="flex items-center gap-3 mb-3">
          <Shield className="w-8 h-8" />
          <h1 className="text-2xl font-bold">Guide des Rôles et Permissions</h1>
        </div>
        <p className="text-stone-100 text-sm leading-relaxed">
          Comprendre les différents rôles disponibles dans votre organisation et leurs permissions associées.
          Choisissez le rôle le plus restrictif possible pour chaque utilisateur.
        </p>
      </div>

      {/* Bonnes pratiques */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Lightbulb className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-amber-900 text-sm mb-2">Bonnes Pratiques</h3>
            <ul className="text-xs text-amber-800 space-y-1">
              <li>• <strong>Principe du moindre privilège</strong> : Donnez le rôle le plus restrictif possible</li>
              <li>• <strong>Utilisez les rôles projet</strong> : Un "user" peut être "owner" d'un projet spécifique</li>
              <li>• <strong>Auditez régulièrement</strong> : Vérifiez que les permissions sont toujours appropriées</li>
              <li>• <strong>Limitez les super_admin</strong> : Idéalement 1-2 personnes maximum</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Tableau comparatif rapide */}
      <div className="bg-white rounded-lg border border-stone-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-200 bg-stone-50">
          <h2 className="font-semibold text-stone-900">Comparaison Rapide</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-stone-50 border-b border-stone-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-stone-700">Fonctionnalité</th>
                <th className="px-3 py-3 text-center font-semibold text-stone-700">Super Admin</th>
                <th className="px-3 py-3 text-center font-semibold text-stone-700">Admin</th>
                <th className="px-3 py-3 text-center font-semibold text-stone-700">Manager</th>
                <th className="px-3 py-3 text-center font-semibold text-stone-700">Team Lead</th>
                <th className="px-3 py-3 text-center font-semibold text-stone-700">User</th>
                <th className="px-3 py-3 text-center font-semibold text-stone-700">Viewer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {[
                { label: 'Voir toutes les tâches', values: [true, true, false, false, false, false] },
                { label: 'Créer des projets', values: [true, true, true, false, false, false] },
                { label: 'Voir toutes les présences', values: [true, true, false, false, false, false] },
                { label: 'Générer des rapports', values: [true, true, true, true, false, false] },
                { label: 'Inviter des membres', values: [true, true, true, false, false, false] },
                { label: 'Modifier ses tâches', values: [true, true, true, true, true, false] }
              ].map((row, idx) => (
                <tr key={idx} className="hover:bg-stone-50">
                  <td className="px-4 py-3 text-stone-700">{row.label}</td>
                  {row.values.map((allowed, i) => (
                    <td key={i} className="px-3 py-3 text-center">
                      {allowed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 mx-auto" />
                      ) : (
                        <XCircle className="w-4 h-4 text-stone-300 mx-auto" />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Détails par rôle */}
      <div className="space-y-3">
        <h2 className="font-semibold text-stone-900 text-lg">Détails par Rôle</h2>
        {roles.map((roleData) => {
          const isExpanded = expandedRole === roleData.role;
          const colors = getRoleColor(roleData.color);

          return (
            <div
              key={roleData.role}
              className="bg-white rounded-lg border border-stone-200 shadow-sm overflow-hidden"
            >
              {/* Header */}
              <button
                onClick={() => setExpandedRole(isExpanded ? null : roleData.role)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-stone-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${colors.bg} ${colors.text}`}>
                    {roleData.icon}
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-stone-900">{roleData.name}</h3>
                    <p className="text-xs text-stone-500 mt-0.5">{roleData.description}</p>
                  </div>
                </div>
                {isExpanded ? (
                  <ChevronUp className="w-5 h-5 text-stone-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-stone-400" />
                )}
              </button>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="px-6 py-4 border-t border-stone-200 bg-stone-50/50 space-y-4">
                  {/* Cas d'usage */}
                  <div>
                    <h4 className="text-xs font-semibold text-stone-700 mb-2 flex items-center gap-2">
                      <Info className="w-4 h-4" />
                      Cas d'usage typiques
                    </h4>
                    <ul className="space-y-1">
                      {roleData.useCases.map((useCase, idx) => (
                        <li key={idx} className="text-xs text-stone-600 flex items-center gap-2">
                          <span className="w-1 h-1 rounded-full bg-stone-400" />
                          {useCase}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Permissions détaillées */}
                  <div>
                    <h4 className="text-xs font-semibold text-stone-700 mb-3">Permissions Détaillées</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {roleData.permissions.map((category, idx) => (
                        <div key={idx} className="bg-white rounded-lg border border-stone-200 p-3">
                          <h5 className="text-xs font-semibold text-stone-700 mb-2">{category.category}</h5>
                          <ul className="space-y-1.5">
                            {category.items.map((item, itemIdx) => (
                              <li key={itemIdx} className="flex items-start gap-2 text-xs">
                                {item.allowed ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                                ) : (
                                  <XCircle className="w-3.5 h-3.5 text-stone-300 shrink-0 mt-0.5" />
                                )}
                                <span className={item.allowed ? 'text-stone-700' : 'text-stone-400'}>
                                  {item.action}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Avertissement sécurité */}
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-900 text-sm mb-2">Avertissement Sécurité</h3>
            <p className="text-xs text-red-800 leading-relaxed">
              Les rôles <strong>super_admin</strong> et <strong>admin</strong> ont un accès total aux données sensibles de l'organisation.
              Ne les attribuez qu'aux personnes de confiance. Un admin peut voir toutes les présences, tous les projets et toutes les tâches.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
