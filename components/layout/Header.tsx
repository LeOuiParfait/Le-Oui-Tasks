'use client'

import React, { useState, useEffect, useRef } from 'react';
import {
  Share2,
  MoreVertical,
  Settings,
  Clock,
  Play,
  Square,
  Coffee,
  Layers,
  Check,
  LogOut,
  User as UserIcon,
} from 'lucide-react';
import { User, AttendanceRecord } from '@/types';

interface HeaderProps {
  title: string;
  users: User[];
  currentUser: User;
  attendanceRecord?: AttendanceRecord;
  onStartWorkday: () => void;
  onEndWorkday: () => void;
  onToggleBreak: () => void;
  onOpenSettings: () => void;
  onSignOut: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  users,
  currentUser,
  attendanceRecord,
  onStartWorkday,
  onEndWorkday,
  onToggleBreak,
  onOpenSettings,
  onSignOut
}) => {
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  const activeMembers = users.filter((u) => u.presenceStatus === 'online' || u.presenceStatus === 'away');

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isWorking = attendanceRecord && attendanceRecord.status === 'working';
  const isOnBreak = attendanceRecord && attendanceRecord.status === 'on_break';

  return (
    <header className="h-16 bg-white border-b border-stone-200 px-3 sm:px-6 flex items-center justify-between shrink-0 z-20">
      {/* Title — hidden on very small screens to make room for hamburger */}
      <div className="flex items-center space-x-3 min-w-0 ml-10 lg:ml-0">
        <div className="p-1.5 rounded-md bg-brand-50 text-brand shrink-0 hidden sm:flex">
          <Layers className="w-4 h-4" />
        </div>
        <h1 className="text-sm sm:text-lg font-bold text-stone-900 tracking-tight truncate">{title}</h1>
      </div>

      {/* Right Controls */}
      <div className="flex items-center space-x-2 sm:space-x-4 shrink-0">
        {/* Workday / Attendance Timer Badge */}
        <div className="flex items-center bg-stone-50 border border-stone-200 rounded-lg p-1 pr-2 sm:pr-3">
          {isWorking ? (
            <div className="flex items-center space-x-1 sm:space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping ml-1 sm:ml-2 shrink-0" />
              <span className="text-[10px] sm:text-xs font-semibold text-stone-800 hidden md:inline">
                En service : {attendanceRecord.startTime}
              </span>
              <button
                onClick={onToggleBreak}
                className="px-1.5 sm:px-2 py-1 text-[10px] sm:text-xs bg-amber-100 text-amber-800 rounded font-medium hover:bg-amber-200 transition-colors flex items-center space-x-1 shrink-0"
              >
                <Coffee className="w-3 h-3" />
                <span className="hidden sm:inline">Pause</span>
              </button>
              <button
                onClick={onEndWorkday}
                className="px-1.5 sm:px-2 py-1 text-[10px] sm:text-xs bg-rose-100 text-rose-800 rounded font-medium hover:bg-rose-200 transition-colors flex items-center space-x-1 shrink-0"
              >
                <Square className="w-3 h-3" />
                <span className="hidden sm:inline">Terminer</span>
              </button>
            </div>
          ) : isOnBreak ? (
            <div className="flex items-center space-x-1 sm:space-x-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 ml-1 sm:ml-2 shrink-0" />
              <span className="text-[10px] sm:text-xs font-semibold text-amber-800">Pause</span>
              <button
                onClick={onToggleBreak}
                className="px-1.5 sm:px-2 py-1 text-[10px] sm:text-xs bg-emerald-600 text-white rounded font-medium hover:bg-emerald-700 transition-colors flex items-center space-x-1 shrink-0"
              >
                <Play className="w-3 h-3" />
                <span className="hidden sm:inline">Reprendre</span>
              </button>
            </div>
          ) : (
            <button
              onClick={onStartWorkday}
              className="flex items-center space-x-1.5 px-2 sm:px-3 py-1.5 bg-emerald-600 text-white rounded-md text-[10px] sm:text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-sm shrink-0"
            >
              <Clock className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Démarrer ma journée</span>
              <span className="sm:hidden">Pointer</span>
            </button>
          )}
        </div>

        {/* Active Team Members Stack — hidden on mobile */}
        <div className="hidden md:flex items-center -space-x-2 overflow-hidden py-1">
          {activeMembers.slice(0, 4).map((member) => (
            member.avatar ? (
              <img
                key={member.id}
                src={member.avatar}
                alt={`${member.firstName} ${member.lastName}`}
                title={`${member.firstName} ${member.lastName} (${member.presenceStatus})`}
                className="inline-block h-8 w-8 rounded-full ring-2 ring-white object-cover"
              />
            ) : (
              <div
                key={member.id}
                title={`${member.firstName} ${member.lastName} (${member.presenceStatus})`}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand text-[10px] font-semibold text-white ring-2 ring-white"
              >
                {member.firstName.charAt(0)}{member.lastName.charAt(0)}
              </div>
            )
          ))}
          {activeMembers.length > 4 && (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-stone-800 text-xs font-medium text-white ring-2 ring-white">
              +{activeMembers.length - 4}
            </div>
          )}
        </div>

        {/* Share Button — hidden on mobile */}
        <button
          onClick={handleShare}
          className="hidden sm:flex items-center space-x-1.5 px-3.5 py-1.5 bg-stone-900 text-white rounded-lg text-xs font-medium hover:bg-stone-800 transition-colors shadow-sm shrink-0"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copié !' : 'Partager'}</span>
        </button>

        {/* More Actions Dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="text-stone-400 hover:text-stone-600 p-1.5 rounded-lg hover:bg-stone-100 transition-colors shrink-0"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-lg border border-stone-200 py-1.5 z-50">
              {/* User info header */}
              <div className="px-3 py-2.5 border-b border-stone-100 mb-1">
                <div className="flex items-center gap-2.5">
                  {currentUser.avatar ? (
                    <img src={currentUser.avatar} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-brand flex items-center justify-center text-white text-xs font-semibold shrink-0">
                      {currentUser.firstName.charAt(0)}{currentUser.lastName.charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-stone-900 truncate">{currentUser.firstName} {currentUser.lastName}</p>
                    <p className="text-xs text-stone-400 truncate">{currentUser.email}</p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => { setMenuOpen(false); onOpenSettings(); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-stone-700 hover:bg-stone-50 transition-colors"
              >
                <UserIcon className="w-4 h-4 text-stone-400 shrink-0" />
                <span>Mon Profil</span>
              </button>

              <button
                onClick={() => { setMenuOpen(false); onOpenSettings(); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-stone-700 hover:bg-stone-50 transition-colors"
              >
                <Settings className="w-4 h-4 text-stone-400 shrink-0" />
                <span>Paramètres</span>
              </button>

              <div className="border-t border-stone-100 my-1" />

              <button
                onClick={() => { setMenuOpen(false); onSignOut(); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                <span>Se déconnecter</span>
              </button>
            </div>
          )}
        </div>

        {/* Settings Icon — hidden on mobile (available in dropdown) */}
        <button
          onClick={onOpenSettings}
          className="hidden sm:block text-stone-400 hover:text-stone-600 p-1.5 rounded-lg hover:bg-stone-100 transition-colors shrink-0"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
