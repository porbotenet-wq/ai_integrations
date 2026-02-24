import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOrgStructure } from '@/shared/api';
import { OBJECT_STATUS_LABELS } from '@/shared/lib/format';
import {
  Phone, AtSign, Shield, Building2, ChevronRight,
  Briefcase, MapPin, Users, ChevronDown, Crown,
  FileCheck, Upload, Clock, Trophy,
} from 'lucide-react';
import type { UserProfile, UserBrief, OrgUnit } from '@/shared/api/types';

interface Props {
  profile: UserProfile;
}

export function ProfileMainTab({ profile }: Props) {
  const navigate = useNavigate();

  return (
    <div className="space-y-2">

      {/* ── Contacts ──────────────────────────────────── */}
      <div className="section-header">Контакты</div>
      <div className="mx-4 card space-y-0">
        {profile.phone && (
          <a
            href={`tel:${profile.phone}`}
            className="flex items-center gap-3 py-3 border-b border-tg-hint/10 touch-target"
          >
            <Phone size={18} className="text-tg-link flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-2xs text-tg-hint">Телефон</div>
              <div className="text-sm text-tg-text">{profile.phone}</div>
            </div>
            <span className="text-2xs text-tg-link">Позвонить</span>
          </a>
        )}
        {profile.email && (
          <a
            href={`mailto:${profile.email}`}
            className="flex items-center gap-3 py-3 border-b border-tg-hint/10 touch-target"
          >
            <AtSign size={18} className="text-tg-link flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-2xs text-tg-hint">Почта</div>
              <div className="text-sm text-tg-text truncate">{profile.email}</div>
            </div>
          </a>
        )}
        {profile.username && (
          <div className="flex items-center gap-3 py-3 border-b border-tg-hint/10">
            <AtSign size={18} className="text-tg-hint flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-2xs text-tg-hint">Telegram</div>
              <div className="text-sm text-tg-text">@{profile.username}</div>
            </div>
          </div>
        )}
        <div className="flex items-center gap-3 py-3">
          <Shield size={18} className="text-tg-accent flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-2xs text-tg-hint">Роль в системе</div>
            <div className="text-sm text-tg-text">{profile.role_name}</div>
          </div>
        </div>
      </div>

      {/* ── Supervisor ────────────────────────────────── */}
      {profile.supervisor && (
        <>
          <div className="section-header mt-2">Руководитель</div>
          <div className="mx-4">
            <PersonCard person={profile.supervisor} showCrown />
          </div>
        </>
      )}

      {/* ── Subordinates ──────────────────────────────── */}
      {profile.subordinates.length > 0 && (
        <>
          <div className="section-header mt-2">
            Подчинённые ({profile.subordinates.length})
          </div>
          <div className="mx-4 space-y-1.5">
            {profile.subordinates.map((sub) => (
              <PersonCard key={sub.id} person={sub} />
            ))}
          </div>
        </>
      )}

      {/* ── KPI Extended ──────────────────────────────── */}
      <div className="section-header mt-2">Показатели эффективности</div>
      <div className="mx-4 card">
        <div className="space-y-3">
          <KPIRow
            icon={<Clock size={16} />}
            label="Ср. время выполнения"
            value={profile.kpi.avg_completion_days !== null
              ? `${profile.kpi.avg_completion_days} дн.` : '—'}
          />
          <KPIRow
            icon={<FileCheck size={16} />}
            label="На согласовании"
            value={String(profile.kpi.approvals_pending)}
            highlight={profile.kpi.approvals_pending > 0}
          />
          <KPIRow
            icon={<Upload size={16} />}
            label="Документов загружено"
            value={String(profile.kpi.documents_uploaded)}
          />
          <KPIRow
            icon={<Trophy size={16} />}
            label="Выполнение в срок"
            value={profile.kpi.on_time_rate !== null ? `${profile.kpi.on_time_rate}%` : '—'}
            highlight={false}
            color={
              profile.kpi.on_time_rate !== null
                ? profile.kpi.on_time_rate >= 80 ? 'text-status-green'
                : profile.kpi.on_time_rate >= 50 ? 'text-status-yellow'
                : 'text-status-red'
                : undefined
            }
          />
        </div>

        {/* On-time rate visual bar */}
        {profile.kpi.on_time_rate !== null && (
          <div className="mt-3 pt-3 border-t border-tg-hint/10">
            <div className="flex items-center justify-between text-2xs text-tg-hint mb-1">
              <span>Процент своевременных задач</span>
              <span className="font-medium text-tg-text">{profile.kpi.on_time_rate}%</span>
            </div>
            <div className="h-2 bg-tg-hint/10 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700
                  ${profile.kpi.on_time_rate >= 80 ? 'bg-status-green'
                    : profile.kpi.on_time_rate >= 50 ? 'bg-status-yellow'
                    : 'bg-status-red'}`}
                style={{ width: `${profile.kpi.on_time_rate}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── My Objects ────────────────────────────────── */}
      {profile.objects.length > 0 && (
        <>
          <div className="section-header mt-2">Мои объекты</div>
          <div className="mx-4 space-y-1.5">
            {profile.objects.map((obj) => (
              <button
                key={obj.id}
                onClick={() => navigate(`/objects/${obj.id}`)}
                className="card w-full text-left active:scale-[0.98] transition-transform touch-target"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Building2 size={18} className="text-tg-hint flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-medium text-tg-text truncate">{obj.name}</h4>
                      <div className="flex items-center gap-2 text-2xs text-tg-hint mt-0.5">
                        <span className={objBadge(obj.status)}>
                          {OBJECT_STATUS_LABELS[obj.status]}
                        </span>
                        <span>·</span>
                        <span className="flex items-center gap-0.5">
                          <Briefcase size={10} /> {obj.role_name}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Mini progress */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="w-10 h-10 relative">
                      <svg viewBox="0 0 36 36" className="w-10 h-10 transform -rotate-90">
                        <circle cx="18" cy="18" r="15" fill="none"
                          stroke="currentColor" strokeWidth="3"
                          className="text-tg-hint/10" />
                        <circle cx="18" cy="18" r="15" fill="none"
                          stroke="currentColor" strokeWidth="3"
                          strokeDasharray={`${obj.progress_pct * 0.942} 100`}
                          strokeLinecap="round"
                          className="text-status-blue" />
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-2xs font-bold text-tg-text">
                        {obj.progress_pct}%
                      </span>
                    </div>
                    <ChevronRight size={16} className="text-tg-hint" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* ── Org Structure ─────────────────────────────── */}
      <OrgStructureSection />

      {/* ── Permissions ───────────────────────────────── */}
      <div className="section-header mt-2">Права доступа</div>
      <div className="mx-4 card">
        <div className="flex flex-wrap gap-1.5">
          {profile.permissions.map((perm) => (
            <span
              key={perm}
              className="text-2xs px-2 py-0.5 bg-tg-hint/10 text-tg-hint rounded-full"
            >
              {formatPermission(perm)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Person Card ───────────────────────────────────────── */

function PersonCard({ person, showCrown }: { person: UserBrief; showCrown?: boolean }) {
  const avatarUrl = person.photo_url
    || `https://ui-avatars.com/api/?name=${encodeURIComponent(person.full_name)}&background=2F80ED&color=fff&size=80&bold=true`;

  return (
    <div className="card flex items-center gap-3">
      <div className="relative flex-shrink-0">
        <img
          src={avatarUrl}
          alt={person.full_name}
          className="w-10 h-10 rounded-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src =
              `https://ui-avatars.com/api/?name=${encodeURIComponent(person.full_name)}&background=2F80ED&color=fff&size=80&bold=true`;
          }}
        />
        {/* Online indicator */}
        <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-tg-section-bg
          ${person.is_online ? 'bg-status-green' : 'bg-tg-hint/40'}`} />
        {showCrown && (
          <span className="absolute -top-1 -right-1">
            <Crown size={12} className="text-status-yellow" />
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-tg-text truncate">{person.full_name}</div>
        <div className="text-2xs text-tg-hint truncate">
          {person.role_name}
          {person.department_name && ` · ${person.department_name}`}
        </div>
      </div>
    </div>
  );
}

/* ── Org Structure (collapsible tree) ──────────────────── */

function OrgStructureSection() {
  const { data: org, isLoading } = useOrgStructure();
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <button
        onClick={() => setExpanded(!expanded)}
        className="section-header mt-2 w-full flex items-center justify-between touch-target"
      >
        <span>Структура компании</span>
        <ChevronDown
          size={14}
          className={`text-tg-hint transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && (
        <div className="mx-4">
          {isLoading ? (
            <div className="card skeleton h-32" />
          ) : org ? (
            <div className="card">
              <OrgNode unit={org} depth={0} />
            </div>
          ) : (
            <div className="card text-center text-tg-hint text-sm py-4">
              Оргструктура не загружена
            </div>
          )}
        </div>
      )}
    </>
  );
}

function OrgNode({ unit, depth }: { unit: OrgUnit; depth: number }) {
  const [open, setOpen] = useState(depth === 0);
  const hasChildren = unit.children.length > 0;
  const indent = depth * 12;

  return (
    <div style={{ marginLeft: `${indent}px` }}>
      <button
        onClick={() => hasChildren && setOpen(!open)}
        className="flex items-center gap-2 py-2 w-full text-left touch-target"
      >
        {hasChildren && (
          <ChevronDown
            size={12}
            className={`text-tg-hint transition-transform flex-shrink-0 ${open ? 'rotate-180' : '-rotate-90'}`}
          />
        )}
        {!hasChildren && <div className="w-3" />}

        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Users size={14} className="text-tg-accent flex-shrink-0" />
          <div className="min-w-0">
            <span className="text-sm font-medium text-tg-text truncate block">{unit.name}</span>
            <span className="text-2xs text-tg-hint">{unit.employee_count} сотр.</span>
          </div>
        </div>

        {unit.head && (
          <span className="text-2xs text-tg-hint truncate max-w-[100px] flex-shrink-0">
            {unit.head.full_name}
          </span>
        )}
      </button>

      {open && hasChildren && (
        <div className="border-l border-tg-hint/10 ml-1.5">
          {unit.children.map((child) => (
            <OrgNode key={child.id} unit={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── KPI Row ───────────────────────────────────────────── */

function KPIRow({ icon, label, value, highlight, color }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="text-tg-hint">{icon}</div>
      <span className="text-sm text-tg-hint flex-1">{label}</span>
      <span className={`text-sm font-semibold ${color || (highlight ? 'text-status-yellow' : 'text-tg-text')}`}>
        {value}
      </span>
    </div>
  );
}

/* ── Helpers ───────────────────────────────────────────── */

function objBadge(status: string): string {
  const map: Record<string, string> = {
    active: 'badge-green', planning: 'badge-blue', draft: 'badge-gray',
    on_hold: 'badge-yellow', completing: 'badge-yellow', closed: 'badge-gray',
  };
  return map[status] || 'badge-gray';
}

function formatPermission(perm: string): string {
  const map: Record<string, string> = {
    'object.create': '➕ Создание объектов',
    'object.edit': '✏️ Редактирование объектов',
    'object.view_all': '👁 Просмотр всех объектов',
    'gpr.create': '📊 Создание ГПР',
    'gpr.sign': '✍️ Подписание ГПР',
    'gpr.edit': '📊 Редактирование ГПР',
    'task.create': '➕ Создание задач',
    'task.assign': '👤 Назначение задач',
    'task.complete': '✅ Завершение задач',
    'task.delete': '🗑 Удаление задач',
    'supply.create': '📦 Создание заявок',
    'supply.approve': '✅ Одобрение заявок',
    'construction.update': '🏗 Обновление этапов',
    'construction.accept': '✅ Приёмка работ',
    'document.upload': '📄 Загрузка документов',
    'document.approve': '✅ Согласование документов',
    'user.manage': '👥 Управление пользователями',
    'audit.view': '📋 Просмотр журнала',
  };
  return map[perm] || perm;
}
