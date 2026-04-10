import { Conversation, type Status, type TextConversation } from "@elevenlabs/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Bot, Loader2, RotateCcw, Send, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type StoredMessage = {
  role: "user" | "assistant";
  content: string;
};

type ElevenLabsChatBoxProps = {
  initialMessages: StoredMessage[];
  className?: string;
  height?: string | number;
};

export function ElevenLabsChatBox({
  initialMessages,
  className,
  height = "70vh",
}: ElevenLabsChatBoxProps) {
  const [messages, setMessages] = useState<StoredMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<Status>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const [isBooting, setIsBooting] = useState(false);
  const [streamingReply, setStreamingReply] = useState("");

  const conversationRef = useRef<TextConversation | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const appendPortalMessage = trpc.ai.appendPortalMessage.useMutation();
  const sessionQuery = trpc.ai.getElevenLabsSession.useQuery(undefined, {
    retry: 1,
  });

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  const scrollToBottom = () => {
    const viewport = scrollAreaRef.current?.querySelector(
      '[data-radix-scroll-area-viewport]'
    ) as HTMLDivElement | null;

    if (viewport) {
      requestAnimationFrame(() => {
        viewport.scrollTo({
          top: viewport.scrollHeight,
          behavior: "smooth",
        });
      });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingReply]);

  useEffect(() => {
    if (sessionQuery.error) {
      setError(sessionQuery.error.message);
      setStatus("disconnected");
      setIsBooting(false);
      return;
    }

    const session = sessionQuery.data;
    if (!session?.signedUrl || conversationRef.current) {
      return;
    }

    let cancelled = false;

    const startSession = async () => {
      try {
        setIsBooting(true);
        setError(null);

        const conversation = await Conversation.startSession({
          signedUrl: session.signedUrl,
          textOnly: true,
          dynamicVariables: session.dynamicVariables,
          overrides: session.overrides,
          userId: String(session.conversationId),
          onStatusChange: ({ status: nextStatus }) => {
            if (!cancelled) {
              setStatus(nextStatus);
            }
          },
          onConnect: () => {
            if (!cancelled) {
              setStatus("connected");
              setError(null);
            }
          },
          onDisconnect: (details) => {
            if (!cancelled) {
              setStatus("disconnected");
              if (details.reason === "error") {
                setError(details.message);
              }
            }
          },
          onError: (message) => {
            if (!cancelled) {
              setError(message);
            }
          },
          onAgentChatResponsePart: (part) => {
            if (cancelled) return;
            if (part.type === "start") {
              setStreamingReply("");
              return;
            }
            if (part.type === "delta") {
              setStreamingReply((prev) => prev + part.text);
              return;
            }
            if (part.type === "stop") {
              setStreamingReply("");
            }
          },
          onMessage: ({ message, role }) => {
            if (cancelled) return;

            const nextMessage: StoredMessage = {
              role: role === "agent" ? "assistant" : "user",
              content: message,
            };

            setMessages((prev) => [...prev, nextMessage]);
            setStreamingReply("");
            appendPortalMessage.mutate({
              conversationId: session.conversationId,
              role: nextMessage.role,
              content: nextMessage.content,
            });
          },
        });

        if (cancelled) {
          await conversation.endSession();
          return;
        }

        conversationRef.current = conversation;
      } catch (err) {
        if (!cancelled) {
          setStatus("disconnected");
          setError(err instanceof Error ? err.message : "Failed to start ElevenLabs chat");
        }
      } finally {
        if (!cancelled) {
          setIsBooting(false);
        }
      }
    };

    void startSession();

    return () => {
      cancelled = true;
      const activeConversation = conversationRef.current;
      conversationRef.current = null;
      if (activeConversation) {
        void activeConversation.endSession();
      }
    };
  }, [appendPortalMessage, sessionQuery.data, sessionQuery.error]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || !conversationRef.current || status !== "connected") {
      return;
    }

    conversationRef.current.sendUserMessage(trimmed);
    setInput("");
  };

  const handleReconnect = async () => {
    const activeConversation = conversationRef.current;
    conversationRef.current = null;
    if (activeConversation) {
      await activeConversation.endSession();
    }
    setStatus("disconnected");
    setStreamingReply("");
    await sessionQuery.refetch();
  };

  return (
    <div
      className={cn(
        "flex flex-col rounded-[1.5rem] border border-[#ddd3c4] bg-[#fffdf9] text-card-foreground",
        className
      )}
      style={{ height }}
    >
      <div className="flex items-center justify-between border-b border-[#ddd3c4] bg-[#f7f2ea] px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-[#0f2e2c]">ElevenLabs Chat Assistant</p>
          <p className="text-xs text-muted-foreground">
            {status === "connected"
              ? "Connected to the live ElevenLabs caregiver agent"
              : isBooting
                ? "Connecting to ElevenLabs..."
                : "Session offline"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium",
              status === "connected"
                ? "bg-[#7a9e8a]/15 text-[#527a68]"
                : "bg-[#d4935a]/12 text-[#9b6535]"
            )}
          >
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                status === "connected" ? "bg-[#7a9e8a]" : "bg-[#d4935a]"
              )}
            />
            {status === "connected" ? "Live" : "Offline"}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full border-[#ddd3c4] bg-white/70 hover:bg-white"
            onClick={() => void handleReconnect()}
            disabled={sessionQuery.isFetching || isBooting}
          >
            <RotateCcw className="mr-2 h-3.5 w-3.5" />
            Reconnect
          </Button>
        </div>
      </div>

      <div ref={scrollAreaRef} className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="space-y-4 p-4">
            {messages.length === 0 && !streamingReply ? (
              <div className="flex min-h-[320px] flex-col items-center justify-center text-center text-muted-foreground">
                <Bot className="mb-4 h-10 w-10 opacity-20" />
                <p className="text-sm">The live ElevenLabs caregiver agent is ready.</p>
                <p className="mt-2 max-w-md text-xs leading-6">
                  Start typing to talk to the same assistant voice and language model you plan to use for live caregiver support.
                </p>
              </div>
            ) : null}

            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={cn(
                  "flex gap-3",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {message.role === "assistant" ? (
                  <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                ) : null}

                <div
                  className={cn(
                    "max-w-[82%] rounded-[1.2rem] px-4 py-3 text-sm",
                    message.role === "user"
                      ? "bg-[#1d4e4b] text-white"
                      : "bg-[#ede7dc] text-foreground"
                  )}
                >
                  <p className="whitespace-pre-wrap leading-6">{message.content}</p>
                </div>

                {message.role === "user" ? (
                  <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
                    <User className="h-4 w-4 text-secondary-foreground" />
                  </div>
                ) : null}
              </div>
            ))}

            {streamingReply ? (
              <div className="flex gap-3">
                <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="max-w-[82%] rounded-[1.2rem] bg-[#ede7dc] px-4 py-3 text-sm text-foreground">
                  <p className="whitespace-pre-wrap leading-6">{streamingReply}</p>
                </div>
              </div>
            ) : null}

            {(isBooting || sessionQuery.isFetching) && messages.length === 0 ? (
              <div className="flex gap-3">
                <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="rounded-[1.2rem] bg-[#ede7dc] px-4 py-3">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            ) : null}
          </div>
        </ScrollArea>
      </div>

      {error ? (
        <div className="border-t border-[#ddd3c4] bg-[#fff1ef] px-4 py-3 text-xs text-[#b42318]">
          {error}
        </div>
      ) : null}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          handleSend();
        }}
        className="flex items-end gap-2 border-t border-[#ddd3c4] bg-[#f7f2ea] p-4"
      >
        <Textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              handleSend();
            }
          }}
          placeholder="Message the ElevenLabs caregiver assistant..."
          className="min-h-9 max-h-32 flex-1 resize-none"
          rows={1}
          disabled={status !== "connected"}
        />
        <Button
          type="submit"
          size="icon"
          disabled={!input.trim() || status !== "connected"}
          className="h-[38px] w-[38px] shrink-0"
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
