// Role detection & labels
export const ROLE_PRIORITY = [
  "director", "pm", "project_opr", "project_km", "project_kmd",
  "supply", "production", "foreman1", "foreman2", "foreman3", "pto", "inspector",
];

export const ROLE_LABELS: Record<string, string> = {
  director: "👔 Директор", pm: "📋 Руководитель проекта",
  project_opr: "📐 ОПР", project_km: "📏 КМ", project_kmd: "✏️ КМД",
  supply: "📦 Снабжение", production: "🏭 Производство",
  foreman1: "🏗️ Прораб", foreman2: "🏗️ Прораб", foreman3: "🏗️ Прораб",
  pto: "📁 ПТО", inspector: "🔍 Технадзор",
};

export const ROLE_PREFIXES: Record<string, string> = {
  director: "d", pm: "pm", project_opr: "opr", project_km: "km", project_kmd: "kmd",
  supply: "sup", production: "prod", foreman1: "f", foreman2: "f", foreman3: "f",
  pto: "pto", inspector: "insp",
};

export function detectPrimaryRole(roles: string[]): string {
  for (const r of ROLE_PRIORITY) {
    if (roles.includes(r)) return r;
  }
  return "generic";
}

export function isForeman(roles: string[]) {
  return roles.some(r => ["foreman1", "foreman2", "foreman3"].includes(r));
}

export function isManager(roles: string[]) {
  return roles.includes("director") || roles.includes("pm");
}

export function rp(roles: string[]) {
  return ROLE_PREFIXES[detectPrimaryRole(roles)] || "g";
}

export function roleLabel(roles: string[]) {
  return ROLE_LABELS[detectPrimaryRole(roles)] || "📋 Сотрудник";
}
