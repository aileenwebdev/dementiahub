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
};

function asTime(value: string | Date) {
  return new Date(value).getTime();
}

function caregiverName(user?: { name?: string | null; email?: string | null } | null) {
  return user?.name || user?.email || "Caregiver case";
}

export function StaffCaseNotifications() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const hasSeededRef = useRef(false);
  const isStaffUser = user?.role === "admin" || user?.role === "staff";
  const storageKey = user ? `dementiahub.staff.seenCases.${user.id}` : null;

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

    const chats = data.chatSupportQueue.map((item) => ({
      key: `chat:${item.conversation.id}`,
      title:
        item.conversation.safetyResult === "UNSAFE" || item.conversation.escalationTriggered
          ? "Urgent chat needs staff"
          : item.conversation.callbackRequested
            ? "Callback requested from chat"
            : "New chat case needs review",
      description: `${caregiverName(item.user)}: ${
        item.conversation.conversationSummary || item.messages[0]?.content || "Open the chat case for triage."
      }`,
      href: `/history/chat/${item.conversation.id}`,
      updatedAt: item.conversation.updatedAt,
      urgency:
        item.conversation.safetyResult === "UNSAFE" || item.conversation.escalationTriggered
          ? "urgent"
          : "normal",
    })) satisfies ActionableCase[];

    const urgentCalls = data.urgentCalls.map((item) => ({
      key: `call:${item.call.sessionId}`,
      title: "Urgent call case needs staff",
      description: `${caregiverName(item.user)}: ${
        item.call.callSummary || "Unsafe or escalated call requires immediate review."
      }`,
      href: `/call/${item.call.sessionId}`,
      updatedAt: item.call.updatedAt,
      urgency: "urgent" as const,
    }));

    const callbackCalls = data.callbackCalls.map((item) => ({
      key: `call:${item.call.sessionId}`,
      title: "Callback requested",
      description: `${caregiverName(item.user)}: ${
        item.call.callSummary || "Caregiver requested follow-up."
      }`,
      href: `/call/${item.call.sessionId}`,
      updatedAt: item.call.updatedAt,
      urgency: "normal" as const,
    }));

    return [...chats, ...urgentCalls, ...callbackCalls]
      .sort((a, b) => asTime(b.updatedAt) - asTime(a.updatedAt))
      .filter((item, index, items) => items.findIndex((candidate) => candidate.key === item.key) === index);
  }, [staffDashboard.data]);

  useEffect(() => {
    if (!isStaffUser || !storageKey || staffDashboard.isLoading || !staffDashboard.data) return;

    const seen = new Set<string>(
      JSON.parse(window.localStorage.getItem(storageKey) || "[]") as string[]
    );
    const currentKeys = actionableCases.map((item) => item.key);

    if (!hasSeededRef.current) {
      if (seen.size === 0 && currentKeys.length > 0) {
        window.localStorage.setItem(storageKey, JSON.stringify(currentKeys));
      }
      hasSeededRef.current = true;
      return;
    }

    const newCases = actionableCases.filter((item) => !seen.has(item.key));
    if (newCases.length === 0) return;

    for (const item of newCases.slice(0, 3)) {
      toast(item.title, {
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
  }, [
    actionableCases,
    isStaffUser,
    setLocation,
    staffDashboard.data,
    staffDashboard.isLoading,
    storageKey,
  ]);

  return null;
}
