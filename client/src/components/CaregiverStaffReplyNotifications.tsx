import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useEffect, useMemo } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

function playStaffReplySound() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    const audioContext = new AudioContextClass();
    const gain = audioContext.createGain();
    gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.14, audioContext.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.55);
    gain.connect(audioContext.destination);

    [660, 880].forEach((frequency, index) => {
      const oscillator = audioContext.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
      oscillator.connect(gain);
      oscillator.start(audioContext.currentTime + index * 0.16);
      oscillator.stop(audioContext.currentTime + index * 0.16 + 0.18);
    });

    window.setTimeout(() => void audioContext.close().catch(() => undefined), 900);
  } catch {
    // Browsers may block audio until the caregiver has interacted with the page.
  }
}

function previewMessage(content: string) {
  const trimmed = content.trim().replace(/\s+/g, " ");
  return trimmed.length > 140 ? `${trimmed.slice(0, 137)}...` : trimmed;
}

export function CaregiverStaffReplyNotifications() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const isCaregiver = user?.role === "user";
  const storageKey = user ? `dementiahub.caregiver.latestStaffMessage.${user.id}` : null;

  const myConversation = trpc.ai.getMyConversation.useQuery(undefined, {
    enabled: isCaregiver,
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    staleTime: 5000,
  });

  const latestStaffMessage = useMemo(() => {
    const staffMessages = myConversation.data?.messages.filter((message) => message.role === "staff") ?? [];
    return staffMessages.at(-1) ?? null;
  }, [myConversation.data?.messages]);

  useEffect(() => {
    if (!isCaregiver || !storageKey || !latestStaffMessage || myConversation.isLoading) return;

    const latestKey = String(latestStaffMessage.id);
    const previousKey = window.localStorage.getItem(storageKey);
    if (previousKey === latestKey) return;

    window.localStorage.setItem(storageKey, latestKey);
    playStaffReplySound();
    toast.success("Human staff replied", {
      description: previewMessage(latestStaffMessage.content),
      duration: 10000,
      action: (
        <Button
          size="sm"
          onClick={() => {
            setLocation("/assistant");
            toast.dismiss();
          }}
        >
          Open
        </Button>
      ),
    });
  }, [isCaregiver, latestStaffMessage, myConversation.isLoading, setLocation, storageKey]);

  return null;
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
