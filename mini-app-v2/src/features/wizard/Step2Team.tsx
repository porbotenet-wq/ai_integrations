import { useState } from 'react';
import { useAvailableUsers, useGPRTemplates } from '@/shared/api';
import {
  UserPlus, X, Check, Search, Users, FileSpreadsheet,
  ChevronDown, MapPin, Crown, Shield,
} from 'lucide-react';
import type {
  CreateObjectStep2, TeamAssignment, AvailableUser, UserRole,
} from '@/shared/api/types';

interface Props {
  data: CreateObjectStep2;
  onChange: (data: CreateObjectStep2) => void;
}

// Required roles that MUST be assigned
const REQUIRED_ROLES: { role: UserRole; label: string; icon: string }[] = [
  { role: 'project_manager', label: 'Руководитель проекта', icon: '👔' },
];

// Optional roles to fill
const OPTIONAL_ROLES: { role: UserRole; label: string; icon: string }[] = [
  { role: 'design_head', label: 'Рук. проектного отдела', icon: '📐' },
  { role: 'designer_opr', label: 'Конструктор ОПР', icon: '📏' },
  { role: 'designer_km', label: 'Конструктор КМ', icon: '📐' },
  { role: 'designer_kmd', label: 'Конструктор КМД', icon: '📐' },
  { role: 'supply', label: 'Снабжение', icon: '📦' },
  { role: 'production', label: 'Производство', icon: '🏭' },
  { role: 'construction_itr', label: 'ИТР / Прораб', icon: '🏗' },
  { role: 'safety', label: 'Охрана труда', icon: '🦺' },
  { role: 'pto', label: 'ПТО', icon: '📋' },
  { role: 'contract', label: 'Договорной отдел', icon: '📝' },
];

const ALL_ROLES = [...REQUIRED_ROLES, ...OPTIONAL_ROLES];

export function Step2Team({ data, onChange }: Props) {
  const { data: users, isLoading: usersLoading } = useAvailableUsers();
  const { data: templates, isLoading: templatesLoading } = useGPRTemplates();
  const [showPicker, setShowPicker] = useState<UserRole | null>(null);
  const [search, setSearch] = useState('');

  function addTeamMember(userId: number, role: UserRole) {
    // Remove existing assignment for this role (one per role)
    const filtered = data.team.filter((t) => t.role !== role);
    onChange({
      ...data,
      team: [...filtered, { user_id: userId, role }],
    });
    setShowPicker(null);
    setSearch('');
    window.Telegram?.WebApp?.HapticFeedback?.selectionChanged();
  }

  function removeTeamMember(role: UserRole) {
    onChange({
      ...data,
      team: data.team.filter((t) => t.role !== role),
    });
  }

  function updateZone(role: UserRole, zone: string) {
    onChange({
      ...data,
      team: data.team.map((t) =>
        t.role === role ? { ...t, zone_of_responsibility: zone } : t
      ),
    });
  }

  function getUserById(id: number): AvailableUser | undefined {
    return users?.find((u) => u.id === id);
  }

  function getAssigned(role: UserRole): TeamAssignment | undefined {
    return data.team.find((t) => t.role === role);
  }

  // Filter users for picker
  const filteredUsers = (users || []).filter((u) => {
    if (!search.trim()) return true;
    return u.full_name.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="space-y-2">

      {/* ── Team Assignment ────────────────────────────── */}
      <div className="section-header">Команда проекта</div>

      {usersLoading ? (
        <div className="mx-4 space-y-2">
          {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-16 rounded-card" />)}
        </div>
      ) : (
        <div className="mx-4 space-y-1.5">
          {ALL_ROLES.map((roleDef) => {
            const assigned = getAssigned(roleDef.role);
            const user = assigned ? getUserById(assigned.user_id) : undefined;
            const isRequired = REQUIRED_ROLES.some((r) => r.role === roleDef.role);

            return (
              <RoleSlot
                key={roleDef.role}
                roleDef={roleDef}
                isRequired={isRequired}
                assignedUser={user || null}
                zone={assigned?.zone_of_responsibility}
                onAssign={() => setShowPicker(roleDef.role)}
                onRemove={() => removeTeamMember(roleDef.role)}
                onZoneChange={(zone) => updateZone(roleDef.role, zone)}
              />
            );
          })}
        </div>
      )}

      {/* ── Team Summary ──────────────────────────────── */}
      <div className="mx-4 mt-2">
        <div className="flex items-center gap-2 text-xs text-tg-hint bg-tg-section-bg rounded-lg px-3 py-2">
          <Users size={14} />
          <span>
            Назначено: <span className="text-tg-text font-medium">{data.team.length}</span>
            {' '}из {ALL_ROLES.length} ролей
          </span>
        </div>
      </div>

      {/* ── GPR Mode ──────────────────────────────────── */}
      <div className="section-header mt-4">График производства работ (ГПР)</div>
      <div className="mx-4 space-y-2">
        {/* Template option */}
        <button
          onClick={() => onChange({ ...data, gpr_mode: 'template' })}
          className={`card w-full text-left transition-colors active:scale-[0.98] touch-target
            ${data.gpr_mode === 'template'
              ? 'ring-2 ring-tg-button'
              : ''}`}
        >
          <div className="flex items-start gap-3">
            <FileSpreadsheet size={20} className={
              data.gpr_mode === 'template' ? 'text-tg-button' : 'text-tg-hint'
            } />
            <div className="flex-1">
              <div className="text-sm font-medium text-tg-text">По шаблону</div>
              <div className="text-2xs text-tg-hint mt-0.5">
                Типовая структура строк ГПР для фасадных работ.
                Правка дат и ответственных после создания.
              </div>
            </div>
            {data.gpr_mode === 'template' && (
              <Check size={16} className="text-tg-button flex-shrink-0 mt-0.5" />
            )}
          </div>
        </button>

        {/* Blank option */}
        <button
          onClick={() => onChange({ ...data, gpr_mode: 'blank', gpr_template_id: undefined })}
          className={`card w-full text-left transition-colors active:scale-[0.98] touch-target
            ${data.gpr_mode === 'blank'
              ? 'ring-2 ring-tg-button'
              : ''}`}
        >
          <div className="flex items-start gap-3">
            <FileSpreadsheet size={20} className={
              data.gpr_mode === 'blank' ? 'text-tg-button' : 'text-tg-hint'
            } />
            <div className="flex-1">
              <div className="text-sm font-medium text-tg-text">Пустой ГПР</div>
              <div className="text-2xs text-tg-hint mt-0.5">
                Ручное создание всех строк ГПР после активации объекта.
              </div>
            </div>
            {data.gpr_mode === 'blank' && (
              <Check size={16} className="text-tg-button flex-shrink-0 mt-0.5" />
            )}
          </div>
        </button>

        {/* Template picker */}
        {data.gpr_mode === 'template' && (
          <div className="mt-2 space-y-1.5">
            {templatesLoading ? (
              <div className="skeleton h-16 rounded-card" />
            ) : (templates || []).length > 0 ? (
              (templates || []).map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => onChange({ ...data, gpr_template_id: tpl.id })}
                  className={`card w-full text-left active:scale-[0.98] touch-target
                    ${data.gpr_template_id === tpl.id
                      ? 'ring-2 ring-status-green bg-status-green/5'
                      : ''}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-tg-text">{tpl.name}</div>
                      <div className="text-2xs text-tg-hint mt-0.5">{tpl.description}</div>
                      <div className="flex items-center gap-2 mt-1 text-2xs text-tg-hint">
                        <span>{tpl.items_count} позиций</span>
                        <span>·</span>
                        <span>{tpl.departments.length} отделов</span>
                      </div>
                    </div>
                    {data.gpr_template_id === tpl.id && (
                      <Check size={16} className="text-status-green flex-shrink-0" />
                    )}
                  </div>
                </button>
              ))
            ) : (
              <div className="text-center text-tg-hint text-sm py-4">
                Шаблоны ГПР не найдены.
                Будет создан пустой ГПР.
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── User Picker Modal ─────────────────────────── */}
      {showPicker && (
        <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setShowPicker(null)}>
          <div
            className="absolute bottom-0 left-0 right-0 bg-tg-bg rounded-t-2xl
              max-h-[75vh] flex flex-col safe-area-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-tg-hint/10">
              <h3 className="text-sm font-bold text-tg-text">
                {ALL_ROLES.find((r) => r.role === showPicker)?.icon}{' '}
                {ALL_ROLES.find((r) => r.role === showPicker)?.label}
              </h3>
              <button
                onClick={() => setShowPicker(null)}
                className="p-2 text-tg-hint touch-target"
              >
                <X size={18} />
              </button>
            </div>

            {/* Search */}
            <div className="px-4 py-2">
              <div className="flex items-center gap-2 bg-tg-section-bg rounded-lg px-3 py-2">
                <Search size={16} className="text-tg-hint" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Поиск сотрудника..."
                  className="flex-1 bg-transparent text-sm text-tg-text
                    placeholder:text-tg-hint/50 outline-none"
                  autoFocus
                />
              </div>
            </div>

            {/* User list */}
            <div className="flex-1 overflow-y-auto px-4 pb-4">
              {filteredUsers.length === 0 ? (
                <div className="text-center text-tg-hint text-sm py-8">
                  Сотрудники не найдены
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredUsers.map((u) => {
                    const isAlreadyAssigned = data.team.some(
                      (t) => t.user_id === u.id && t.role !== showPicker
                    );
                    const isThisRole = data.team.some(
                      (t) => t.user_id === u.id && t.role === showPicker
                    );

                    return (
                      <button
                        key={u.id}
                        onClick={() => addTeamMember(u.id, showPicker!)}
                        className={`w-full flex items-center gap-3 py-3 px-2 rounded-lg
                          text-left touch-target transition-colors
                          ${isThisRole ? 'bg-tg-button/10' : 'active:bg-tg-section-bg'}`}
                      >
                        <UserAvatar name={u.full_name} url={u.photo_url} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-tg-text truncate">
                            {u.full_name}
                          </div>
                          <div className="text-2xs text-tg-hint">
                            {u.role_name}
                            {u.department_name && ` · ${u.department_name}`}
                          </div>
                          {u.active_objects_count > 0 && (
                            <div className="text-2xs text-tg-hint mt-0.5">
                              Активных объектов: {u.active_objects_count}
                            </div>
                          )}
                        </div>
                        {isThisRole && (
                          <Check size={16} className="text-tg-button flex-shrink-0" />
                        )}
                        {isAlreadyAssigned && (
                          <span className="text-2xs text-status-yellow flex-shrink-0">
                            уже в команде
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Role Slot ─────────────────────────────────────────── */

function RoleSlot({ roleDef, isRequired, assignedUser, zone, onAssign, onRemove, onZoneChange }: {
  roleDef: { role: UserRole; label: string; icon: string };
  isRequired: boolean;
  assignedUser: AvailableUser | null;
  zone?: string;
  onAssign: () => void;
  onRemove: () => void;
  onZoneChange: (zone: string) => void;
}) {
  const [showZone, setShowZone] = useState(false);

  return (
    <div className={`card ${isRequired && !assignedUser ? 'ring-1 ring-status-red/30' : ''}`}>
      <div className="flex items-center gap-3">
        {/* Role icon */}
        <span className="text-lg flex-shrink-0">{roleDef.icon}</span>

        {assignedUser ? (
          // Assigned state
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-tg-text truncate">
                {assignedUser.full_name}
              </span>
              {isRequired && <Crown size={12} className="text-status-yellow flex-shrink-0" />}
            </div>
            <div className="text-2xs text-tg-hint">{roleDef.label}</div>

            {/* Zone input toggle */}
            {(roleDef.role === 'construction_itr' || showZone) && (
              <div className="mt-1.5">
                <div className="flex items-center gap-1">
                  <MapPin size={10} className="text-tg-hint" />
                  <input
                    type="text"
                    value={zone || ''}
                    onChange={(e) => onZoneChange(e.target.value)}
                    placeholder="Зона: Фасад 1, этажи 2-18"
                    className="text-2xs text-tg-text bg-transparent border-b border-tg-hint/15
                      outline-none flex-1 pb-0.5 placeholder:text-tg-hint/40"
                  />
                </div>
              </div>
            )}
          </div>
        ) : (
          // Empty state
          <div className="flex-1">
            <div className="text-sm text-tg-hint">{roleDef.label}</div>
            {isRequired && (
              <div className="text-2xs text-status-red">Обязательная роль</div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {assignedUser ? (
            <>
              {!showZone && roleDef.role !== 'construction_itr' && (
                <button
                  onClick={() => setShowZone(true)}
                  className="p-1.5 text-tg-hint touch-target"
                  title="Зона ответственности"
                >
                  <MapPin size={14} />
                </button>
              )}
              <button
                onClick={onRemove}
                className="p-1.5 text-tg-hint touch-target"
              >
                <X size={14} />
              </button>
              <button
                onClick={onAssign}
                className="p-1.5 text-tg-link touch-target"
              >
                <ChevronDown size={14} />
              </button>
            </>
          ) : (
            <button
              onClick={onAssign}
              className="flex items-center gap-1 px-3 py-1.5 bg-tg-button/10
                text-tg-button text-xs rounded-lg touch-target"
            >
              <UserPlus size={12} />
              Назначить
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── User Avatar ───────────────────────────────────────── */

function UserAvatar({ name, url }: { name: string; url: string | null }) {
  const fallback = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=2F80ED&color=fff&size=80&bold=true`;

  return (
    <img
      src={url || fallback}
      alt={name}
      className="w-9 h-9 rounded-full object-cover flex-shrink-0"
      onError={(e) => { (e.target as HTMLImageElement).src = fallback; }}
    />
  );
}
