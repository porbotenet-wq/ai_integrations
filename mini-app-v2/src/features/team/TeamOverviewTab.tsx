import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import { Users, AlertTriangle, Clock, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';

interface Props {
  objectId: number;
}

interface TaskItem {
  id: number;
  title: string;
  status: string;
  priority: number;
  deadline: string | null;
  days_left: number | null;
  overdue: boolean;
}

interface TeamMember {
  id: number;
  name: string;
  role: string;
  tasks: TaskItem[];
  overdue: number;
  total: number;
}

interface TeamData {
  team: TeamMember[];
  unassigned: any[];
  summary: {
    total_people: number;
    total_tasks: number;
    total_overdue: number;
    unassigned_count: number;
  };
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Админ',
  project_manager: 'Руководитель проекта',
  director: 'Директор',
  curator: 'Куратор',
  construction_itr: 'Прораб',
  installer: 'Монтажник',
  geodesist: 'Геодезист',
  supply: 'Снабжение',
  production: 'Производство',
  design_head: 'ГИП',
  designer_opr: 'Проектировщик ОПР',
  designer_km: 'Проектировщик КМ',
  designer_kmd: 'Проектировщик КМД',
  safety: 'Охрана труда',
  pto: 'ПТО',
  contract: 'Договорной',
  viewer: 'Наблюдатель',
};

const STATUS_EMOJI: Record<string, string> = {
  new: '⬜', in_progress: '🔵', review: '🟣', overdue: '🔴',
  blocked: '🟡', done: '🟢', cancelled: '⚫',
};

export function TeamOverviewTab({ objectId }: Props) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const { data, isLoading } = useQuery<TeamData>({
    queryKey: ['team-tasks', objectId],
    queryFn: () => api.get(`/api/objects/${objectId}/team-tasks`),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-tg-hint" size={24} />
      </div>
    );
  }

  const { team = [], unassigned = [], summary } = data || {};

  const toggle = (id: number) =>
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="space-y-3">
      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-4 gap-2">
          <StatCard icon="👥" value={summary.total_people} label="Сотрудников" />
          <StatCard icon="📋" value={summary.total_tasks} label="Задач" />
          <StatCard icon="🔴" value={summary.total_overdue} label="Просрочено" alert={summary.total_overdue > 0} />
          <StatCard icon="❓" value={summary.unassigned_count} label="Без исп." />
        </div>
      )}

      {/* Team members */}
      {team.map((member) => (
        <div key={member.id} className="bg-tg-section-bg rounded-2xl overflow-hidden">
          <button
            onClick={() => toggle(member.id)}
            className="w-full flex items-center justify-between px-3 py-3 active:bg-tg-hint/5"
          >
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm
                ${member.overdue > 0 ? 'bg-red-500/10' : 'bg-tg-button/10'}`}>
                {member.name.charAt(0)}
              </div>
              <div className="text-left">
                <div className="text-sm font-medium text-tg-text">{member.name}</div>
                <div className="text-2xs text-tg-hint">{ROLE_LABELS[member.role] || member.role}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {member.overdue > 0 && (
                <span className="flex items-center gap-0.5 text-2xs text-red-400">
                  <AlertTriangle size={10} /> {member.overdue}
                </span>
              )}
              <span className="text-xs text-tg-hint">{member.total}</span>
              {expanded[member.id] ? <ChevronUp size={14} className="text-tg-hint" /> : <ChevronDown size={14} className="text-tg-hint" />}
            </div>
          </button>

          {expanded[member.id] && (
            <div className="border-t border-tg-hint/10 divide-y divide-tg-hint/5">
              {member.tasks.map((task) => (
                <div key={task.id} className="px-3 py-2 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs">{STATUS_EMOJI[task.status] || '⬜'}</span>
                      <span className="text-xs text-tg-text truncate">{task.title}</span>
                    </div>
                  </div>
                  <div className="flex-shrink-0 ml-2">
                    {task.deadline && (
                      <span className={`text-2xs font-mono ${
                        task.overdue ? 'text-red-400' :
                        task.days_left !== null && task.days_left <= 3 ? 'text-yellow-400' :
                        'text-tg-hint'
                      }`}>
                        {task.overdue
                          ? `−${Math.abs(task.days_left!)} дн.`
                          : task.days_left !== null
                            ? `${task.days_left} дн.`
                            : ''}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Unassigned */}
      {unassigned.length > 0 && (
        <div className="bg-tg-section-bg rounded-2xl overflow-hidden">
          <div className="px-3 py-2 border-b border-tg-hint/10">
            <span className="text-xs font-medium text-tg-hint">❓ Без исполнителя ({unassigned.length})</span>
          </div>
          <div className="divide-y divide-tg-hint/5">
            {unassigned.map((task: any) => (
              <div key={task.id} className="px-3 py-2 flex items-center justify-between">
                <span className="text-xs text-tg-text truncate">{task.title}</span>
                {task.deadline && (
                  <span className="text-2xs text-tg-hint ml-2">{task.deadline}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {team.length === 0 && unassigned.length === 0 && (
        <div className="text-center py-8 text-tg-hint text-sm">Нет активных задач</div>
      )}
    </div>
  );
}

function StatCard({ icon, value, label, alert }: { icon: string; value: number; label: string; alert?: boolean }) {
  return (
    <div className={`bg-tg-section-bg rounded-xl px-2 py-2 text-center ${alert ? 'ring-1 ring-red-500/30' : ''}`}>
      <div className="text-sm">{icon}</div>
      <div className={`text-lg font-bold ${alert ? 'text-red-400' : 'text-tg-text'}`}>{value}</div>
      <div className="text-2xs text-tg-hint">{label}</div>
    </div>
  );
}
