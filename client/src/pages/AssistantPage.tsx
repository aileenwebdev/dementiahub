import { AIChatBox, type Message as PortalMessage } from "@/components/AIChatBox";
import DashboardLayout from "@/components/DashboardLayout";
import { ElevenLabsChatBox } from "@/components/ElevenLabsChatBox";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Brain, Headphones, MessagesSquare, Shield, UserRound } from "lucide-react";
import { toast } from "sonner";

export default function AssistantPage() {
  const dataQueryUtils = trpc.useUtils();
  const { data } = trpc.ai.getMyConversation.useQuery(undefined, {
    staleTime: 1000 * 10,
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
  const { data: identity } = trpc.identity.getMyIdentity.useQuery(undefined, {
    staleTime: 1000 * 60 * 10,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const appendPortalMessage = trpc.ai.appendPortalMessage.useMutation({
    onSuccess: () => {
      void dataQueryUtils.ai.getMyConversation.invalidate();
    },
    onError: (error) => toast.error("Could not send message", { description: error.message }),
  });

  const humanSupportMessages: PortalMessage[] =
    data?.messages
      .filter((message) => message.role !== "system")
      .map((message) => ({
        role: message.role as "user" | "assistant" | "staff",
        content: message.content,
      })) ?? [];

  const sidebar = (
    <div className="cg-sidebar-card sticky top-[104px] rounded-[1.6rem] p-6">
      <p className="mb-4 text-[11px] uppercase tracking-[0.18em] text-white/32">Caregiver Profile</p>
      <div className="rounded-[1.25rem] border border-white/10 bg-white/6 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#7a9e8a]/18">
            <UserRound className="h-4 w-4 text-[#edb27e]" />
          </div>
          <div>
            <p className="text-sm text-white/45">Portal profile</p>
            <p className="text-lg font-medium text-white">{data?.conversation.portalUserId ? "Recognized" : "Loading..."}</p>
          </div>
        </div>

        <div className="mt-4 space-y-3 text-sm">
          <div>
            <p className="text-white/36">Wibiz contact</p>
            <div className="mt-1">
              {identity?.ghlContactId ? (
                <Badge className="bg-[#d4935a]/18 text-[#edb27e] hover:bg-[#d4935a]/18">Linked</Badge>
              ) : (
                <Badge variant="outline" className="border-white/14 text-white/68">Not linked yet</Badge>
              )}
            </div>
          </div>
          <div>
            <p className="text-white/36">Phone number</p>
            <p className="mt-1 text-white/78">{identity?.phoneNumber ?? "Not provided"}</p>
          </div>
          <div>
            <p className="text-white/36">Language</p>
            <p className="mt-1 text-white/78">{identity?.preferredLanguage ?? "English"}</p>
          </div>
        </div>
      </div>

      <p className="mb-4 mt-6 text-[11px] uppercase tracking-[0.18em] text-white/32">Conversation Memory</p>
      <div className="rounded-[1.25rem] border border-white/10 bg-white/6 p-5 text-sm leading-6 text-white/68">
        The assistant uses the logged-in caregiver profile from this portal session and reloads saved history each time the same user comes back.
      </div>

      <p className="mb-4 mt-6 text-[11px] uppercase tracking-[0.18em] text-white/32">Support Status</p>
      <div className="rounded-[1.25rem] border border-white/10 bg-white/6 p-5 text-sm leading-6 text-white/68">
        <div className="flex items-center justify-between">
          <span>Conversation</span>
          <Badge className="bg-[#7a9e8a]/18 text-[#edb27e] hover:bg-[#7a9e8a]/18">Saved</Badge>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span>Wibiz support</span>
          <span className="text-white/84">{data?.conversation.ghlSynced ? "Synced" : "Ready"}</span>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span>Support mode</span>
          <span className="text-white/84">{data?.conversation.humanTakeover ? "Human support" : "Assistant"}</span>
        </div>
      </div>
    </div>
  );

  return (
    <DashboardLayout sidebar={sidebar}>
      <div className="space-y-6">
        <section className="cg-panel rounded-[2rem] px-6 py-7 sm:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="cg-label">Caregiver Support Assistant</p>
              <h1 className="cg-display mt-2 text-4xl font-bold text-[#0f2e2c] sm:text-5xl">
                One caregiver, one continuous conversation.
              </h1>
              <p className="mt-3 text-sm leading-7 text-muted-foreground sm:text-base">
                This assistant stays anchored to your caregiver profile, so support feels continuous and your saved history remains inside the caregiver portal.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#7a9e8a]/22 bg-[#7a9e8a]/10 px-4 py-2 text-sm font-medium text-[#527a68]">
              <span className="h-2 w-2 rounded-full bg-[#7a9e8a]" />
              Support assistant online
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {[
            {
              icon: UserRound,
              title: "Recognized identity",
              text: "The assistant uses the logged-in caregiver profile before every session starts.",
            },
            {
              icon: MessagesSquare,
              title: "Saved history",
              text: "User and assistant messages are mirrored into the portal and reloaded on return.",
            },
            {
              icon: Shield,
              title: "Auto triage",
              text: "When a conversation needs follow-up, it can move into staff support without losing context.",
            },
          ].map((item) => (
            <div key={item.title} className="cg-stat rounded-[1.5rem] p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#1d4e4b]/10 text-[#1d4e4b]">
                <item.icon className="h-5 w-5" />
              </div>
              <h2 className="mt-4 text-xl font-semibold text-[#0f2e2c]">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.text}</p>
            </div>
          ))}
        </section>

        <Card className="cg-panel overflow-hidden rounded-[2rem] border-0">
          <CardHeader className="border-b border-[#ddd3c4] bg-white/35 px-6 py-5">
            <CardTitle className="flex items-center gap-2 text-xl text-[#0f2e2c]">
              {data?.conversation.humanTakeover ? (
                <Headphones className="h-5 w-5 text-sky-700" />
              ) : (
                <Brain className="h-5 w-5 text-[#1d4e4b]" />
              )}
              {data?.conversation.humanTakeover ? "Human Support Chat" : "Caregiver Support Assistant"}
            </CardTitle>
            <CardDescription>
              {data?.conversation.humanTakeover
                ? "A staff member has taken over this case. New messages go to the human support team instead of the AI assistant."
                : "This portal chat keeps your caregiver identity, conversation history, and Wibiz support record connected."}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {data?.conversation.humanTakeover ? (
              <AIChatBox
                messages={humanSupportMessages}
                onSendMessage={(content) =>
                  appendPortalMessage.mutate({
                    conversationId: data.conversation.id,
                    role: "user",
                    content,
                  })
                }
                isLoading={appendPortalMessage.isPending}
                placeholder="Message the human support team..."
                height="70vh"
                className="rounded-none border-0 bg-transparent shadow-none"
                emptyStateMessage="Your human support thread is ready."
              />
            ) : (
              <ElevenLabsChatBox
                initialMessages={
                  data?.messages
                    .filter((message) => message.role !== "system")
                    .map((message) => ({
                      role: message.role as "user" | "assistant" | "staff",
                      content: message.content,
                    })) ?? []
                }
                height="70vh"
                className="rounded-none border-0 bg-transparent shadow-none"
              />
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
