import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

type ActionableCase = {
  key: string;
  title: string;
  description: string;
  href: string;
  updatedAt: string | Date;
  urgency: "urgent" | "normal";
  safetyState: "none" | "unsafe" | "escalated" | "unsafe_escalated";
};

function asTime(value: string | Date) {
  return new Date(value).getTime();
}

function caregiverName(user?: { name?: string | null; email?: string | null } | null) {
  return user?.name || user?.email || "Caregiver case";
}

function getSafetyState(params: {
  safetyResult?: string | null;
  escalationTriggered?: boolean | null;
}): ActionableCase["safetyState"] {
  const unsafe = params.safetyResult === "UNSAFE";
  const escalated = Boolean(params.escalationTriggered);
  if (unsafe && escalated) return "unsafe_escalated";
  if (unsafe) return "unsafe";
  if (escalated) return "escalated";
  return "none";
}

function isUrgentState(state: ActionableCase["safetyState"]) {
  return state === "unsafe" || state === "escalated" || state === "unsafe_escalated";
}

function playUrgentCaseSound() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    const audioContext = new AudioContextClass();
    const gain = audioContext.createGain();
    gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, audioContext.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.9);
    gain.connect(audioContext.destination);

    [880, 660, 880].forEach((frequency, index) => {
      const oscillator = audioContext.createOscillator();
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
      oscillator.connect(gain);
      oscillator.start(audioContext.currentTime + index * 0.2);
      oscillator.stop(audioContext.currentTime + index * 0.2 + 0.16);
    });

    window.setTimeout(() => void audioContext.close().catch(() => undefined), 1200);
  } catch {
    // Browsers may block audio until staff/admin has interacted with the page.
  }
}

export function StaffCaseNotifications() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const hasSeededRef = useRef(false);
  const isStaffUser = user?.role === "admin" || user?.role === "staff";
  const storageKey = user ? `dementiahub.staff.seenCases.${user.id}` : null;
  const safetyStateStorageKey = user ? `dementiahub.staff.caseSafetyStates.${user.id}` : null;

  const staffDashboard = trpc.admin.staffDashboard.useQuery(undefined, {
    enabled: isStaffUser,
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    staleTime: 5000,
  });

  const actionableCases = useMemo<ActionableCase[]>(() => {
    const data = staffDashboard.data;
    if (!data) return [];

    const chats = data.chatSupportQueue.map((item) => {
      const safetyState = getSafetyState({
        safetyResult: item.conversation.safetyResult,
        escalationTriggered: item.conversation.escalationTriggered,
      });
      return {
        key: `chat:${item.conversation.id}`,
        title:
          isUrgentState(safetyState)
            ? "Unsafe chat trigger"
            : item.conversation.callbackRequested
              ? "Callback requested from chat"
              : "New chat case needs review",
        description: `${caregiverName(item.user)}: ${
          item.conversation.conversationSummary || item.messages[0]?.content || "Open the chat case for triage."
        }`,
        href: `/history/chat/${item.conversation.id}`,
        updatedAt: item.conversation.updatedAt,
        urgency: isUrgentState(safetyState) ? "urgent" : "normal",
        safetyState,
      };
    }) satisfies ActionableCase[];

    const urgentCalls = data.urgentCalls.map((item) => {
      const safetyState = getSafetyState({
        safetyResult: item.call.safetyResult,
        escalationTriggered: item.call.escalationTriggered,
      });
      return {
        key: `call:${item.call.sessionId}`,
        title: "Unsafe call trigger",
        description: `${caregiverName(item.user)}: ${
          item.call.callSummary || "Unsafe or escalated call requires immediate review."
        }`,
        href: `/call/${item.call.sessionId}`,
        updatedAt: item.call.updatedAt,
        urgency: "urgent" as const,
        safetyState,
      };
    });

    const callbackCalls = data.callbackCalls.map((item) => ({
      key: `call:${item.call.sessionId}`,
      title: "Callback requested",
      description: `${caregiverName(item.user)}: ${
        item.call.callSummary || "Caregiver requested follow-up."
      }`,
      href: `/call/${item.call.sessionId}`,
      updatedAt: item.call.updatedAt,
      urgency: "normal" as const,
      safetyState: getSafetyState({
        safetyResult: item.call.safetyResult,
        escalationTriggered: item.call.escalationTriggered,
      }),
    }));

    return [...chats, ...urgentCalls, ...callbackCalls]
      .sort((a, b) => asTime(b.updatedAt) - asTime(a.updatedAt))
      .filter((item, index, items) => items.findIndex((candidate) => candidate.key === item.key) === index);
  }, [staffDashboard.data]);

  useEffect(() => {
    if (
      !isStaffUser ||
      !storageKey ||
      !safetyStateStorageKey ||
      staffDashboard.isLoading ||
      !staffDashboard.data
    ) {
      return;
    }

    const seen = new Set<string>(
      JSON.parse(window.localStorage.getItem(storageKey) || "[]") as string[]
    );
    const previousSafetyStates = JSON.parse(
      window.localStorage.getItem(safetyStateStorageKey) || "{}"
    ) as Record<string, ActionableCase["safetyState"] | undefined>;
    const currentSafetyStates = actionableCases.reduce<Record<string, ActionableCase["safetyState"]>>(
      (states, item) => {
        states[item.key] = item.safetyState;
        return states;
      },
      {}
    );
    const currentKeys = actionableCases.map((item) => item.key);

    if (!hasSeededRef.current) {
      if (seen.size === 0 && currentKeys.length > 0) {
        window.localStorage.setItem(storageKey, JSON.stringify(currentKeys));
      }
      window.localStorage.setItem(safetyStateStorageKey, JSON.stringify(currentSafetyStates));
      hasSeededRef.current = true;
      return;
    }

    const newCases = actionableCases.filter((item) => !seen.has(item.key));
    const urgentStateChanges = actionableCases.filter((item) => {
      const previousState = previousSafetyStates[item.key] ?? "none";
      return !isUrgentState(previousState) && isUrgentState(item.safetyState);
    });
    const alerts = [...urgentStateChanges, ...newCases]
      .sort((a, b) => (a.urgency === b.urgency ? 0 : a.urgency === "urgent" ? -1 : 1))
      .filter((item, index, items) => items.findIndex((candidate) => candidate.key === item.key) === index);

    if (alerts.length === 0) {
      window.localStorage.setItem(safetyStateStorageKey, JSON.stringify(currentSafetyStates));
      return;
    }

    for (const item of alerts.slice(0, 3)) {
      if (item.urgency === "urgent") {
        playUrgentCaseSound();
      }
      const showToast = item.urgency === "urgent" ? toast.error : toast;
      showToast(item.title, {
        description: item.description,
        duration: item.urgency === "urgent" ? 12000 : 8000,
        action: (
          <Button
            size="sm"
            onClick={() => {
              setLocation(item.href);
              toast.dismiss();
            }}
          >
            Open
          </Button>
        ),
      });
      seen.add(item.key);
    }

    window.localStorage.setItem(storageKey, JSON.stringify(Array.from(seen).slice(-250)));
    window.localStorage.setItem(safetyStateStorageKey, JSON.stringify(currentSafetyStates));
  }, [
    actionableCases,
    isStaffUser,
    safetyStateStorageKey,
    setLocation,
    staffDashboard.data,
    staffDashboard.isLoading,
    storageKey,
  ]);

  return null;
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
