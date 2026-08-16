'use client'

import React from 'react';
import { X, Shield, UserCheck, Check } from 'lucide-react';
import { User } from '@/types';

interface DemoRoleSwitcherProps {
  users: User[];
  currentUser: User;
  onSelectUser: (userId: string) => void;
  onClose: () => void;
}

export const DemoRoleSwitcher: React.FC<DemoRoleSwitcherProps> = ({
  users,
  currentUser,
  onSelectUser,
  onClose
}) => {
  return (
    <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-lg space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <div className="flex items-center space-x-2">
            <UserCheck className="w-5 h-5 text-brand" />
            <h2 className="text-base font-bold text-stone-900">Changer de Rôle de Démonstration</h2>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 p-1.5 rounded-full hover:bg-stone-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-stone-500">
          Sélectionnez un rôle ci-dessous pour tester les permissions (Super Admin, validation Manager ou vue Employé) :
        </p>

        <div className="space-y-2">
          {users.map((u) => {
            const isSelected = u.id === currentUser.id;
            return (
              <div
                key={u.id}
                onClick={() => {
                  onSelectUser(u.id);
                  onClose();
                }}
                className={`p-3 rounded-2xl border cursor-pointer flex items-center justify-between transition-all ${
                  isSelected
                    ? 'bg-brand-50 border-brand-light shadow-sm'
                    : 'bg-white border-stone-200 hover:bg-stone-50'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <img src={u.avatar} alt={u.firstName} className="w-9 h-9 rounded-full object-cover border" />
                  <div>
                    <span className="font-bold text-xs text-stone-900 block">
                      {u.firstName} {u.lastName}
                    </span>
                    <span className="text-[10px] font-semibold text-stone-500 uppercase">
                      {u.role.replace('_', ' ')} • {u.jobTitle}
                    </span>
                  </div>
                </div>

                {isSelected && <Check className="w-4 h-4 text-brand" />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
