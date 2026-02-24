// src/lib/detectPrimaryRole.ts
// Priority: director > pm > opr > km > kmd > supply > production > foreman > pto > inspector
const ROLE_PRIORITY: string[] = [
  "director", "pm", "opr", "km", "kmd", "supply", "production",
  "foreman1", "foreman2", "foreman3", "pto", "inspector",
];

export function detectPrimaryRole(roles: string[]): string {
  for (const r of ROLE_PRIORITY) {
    if (roles.includes(r)) return r;
  }
  return roles[0] || "user";
}

export function isForeman(role: string): boolean {
  return ["foreman1", "foreman2", "foreman3"].includes(role);
}
