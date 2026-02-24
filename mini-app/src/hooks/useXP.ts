import { useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { awardXP, XP_REWARDS } from "@/lib/gamification";

interface XpEvent {
  xp: number;
  action: string;
}

export function useXP(projectId: string) {
  const { user } = useAuth();
  const [lastXp, setLastXp] = useState<XpEvent | null>(null);

  const award = useCallback(
    async (action: string, metadata?: Record<string, unknown>) => {
      if (!user) return;
      const result = await awardXP(user.id, projectId, action, metadata);
      if (result) {
        setLastXp({ xp: XP_REWARDS[action] || 0, action });
      }
    },
    [user, projectId]
  );

  const clearXp = useCallback(() => setLastXp(null), []);

  return { award, lastXp, clearXp };
}
