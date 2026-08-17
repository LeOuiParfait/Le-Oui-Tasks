'use client'

import { Notification } from '@/types'
import { Bell, Check, CheckCheck, Trash2 } from 'lucide-react'
import { useMemo } from 'react'

interface NotificationsViewProps {
  notifications: Notification[]
  onMarkRead: (id: string) => void
  onMarkAllRead: () => void
  onDelete: (id: string) => void
}

export function NotificationsView({
  notifications,
  onMarkRead,
  onMarkAllRead,
  onDelete
}: NotificationsViewProps) {
  const sorted = useMemo(() => {
    return [...notifications].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  }, [notifications])

  const unreadCount = sorted.filter((n) => !n.read).length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-brand">Centre de notifications</h2>
        {unreadCount > 0 && (
          <button
            onClick={onMarkAllRead}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-brand rounded-lg hover:opacity-90 transition"
          >
            <CheckCheck className="w-4 h-4" />
            Tout marquer comme lu
          </button>
        )}
      </div>

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-stone-500">
          <Bell className="w-12 h-12 mb-4 opacity-20" />
          <p>Aucune notification pour le moment.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((n) => (
            <div
              key={n.id}
              className={`flex items-start gap-4 p-4 rounded-xl border transition ${
                n.read ? 'bg-white border-stone-100' : 'bg-stone-50 border-brand/20'
              }`}
            >
              <div
                className={`mt-1 w-2.5 h-2.5 rounded-full shrink-0 ${
                  n.read ? 'bg-stone-200' : 'bg-brand'
                }`}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-3">
                  <h3 className={`text-brand ${!n.read ? 'font-semibold' : 'font-medium'}`}>
                    {n.title}
                  </h3>
                  <span className="text-xs text-stone-400 whitespace-nowrap">
                    {n.createdAt && !Number.isNaN(Date.parse(n.createdAt))
                      ? new Date(n.createdAt).toLocaleString('fr-FR')
                      : '—'}
                  </span>
                </div>
                <p className="text-sm text-stone-600 mt-1">{n.message}</p>
                {n.link && (
                  <a
                    href={n.link}
                    className="inline-block mt-2 text-sm font-medium text-brand hover:underline"
                  >
                    Voir le détail
                  </a>
                )}
              </div>
              <div className="flex items-center gap-1">
                {!n.read && (
                  <button
                    onClick={() => onMarkRead(n.id)}
                    title="Marquer comme lu"
                    className="p-2 text-stone-500 hover:text-brand hover:bg-stone-100 rounded-lg transition"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => onDelete(n.id)}
                  title="Supprimer"
                  className="p-2 text-stone-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
