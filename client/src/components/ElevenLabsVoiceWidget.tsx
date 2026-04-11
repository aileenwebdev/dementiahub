import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const WIDGET_SCRIPT_ID = "elevenlabs-convai-widget-script";
const WIDGET_SCRIPT_SRC = "https://unpkg.com/@elevenlabs/convai-widget-embed";

type ElevenLabsVoiceWidgetProps = {
  signedUrl: string;
  dynamicVariables: Record<string, string>;
  overridePrompt?: string;
  overrideFirstMessage?: string;
  className?: string;
};

let widgetScriptPromise: Promise<void> | null = null;

function ensureWidgetScript() {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  if (window.customElements?.get("elevenlabs-convai")) {
    return Promise.resolve();
  }

  if (widgetScriptPromise) {
    return widgetScriptPromise;
  }

  const existing = document.getElementById(WIDGET_SCRIPT_ID) as HTMLScriptElement | null;
  if (existing) {
    if (existing.dataset.loaded === "true") {
      return Promise.resolve();
    }

    widgetScriptPromise = new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load ElevenLabs widget script.")), {
        once: true,
      });
    });
    return widgetScriptPromise;
  }

  widgetScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.id = WIDGET_SCRIPT_ID;
    script.src = WIDGET_SCRIPT_SRC;
    script.async = true;
    script.type = "text/javascript";
    script.onload = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = () => reject(new Error("Failed to load ElevenLabs widget script."));
    document.body.appendChild(script);
  });

  return widgetScriptPromise;
}

export function ElevenLabsVoiceWidget({
  signedUrl,
  dynamicVariables,
  overridePrompt,
  overrideFirstMessage,
  className,
}: ElevenLabsVoiceWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const mountWidget = async () => {
      try {
        setLoading(true);
        setError(null);
        await ensureWidgetScript();
        if (cancelled || !containerRef.current) {
          return;
        }

        containerRef.current.innerHTML = "";

        const widget = document.createElement("elevenlabs-convai");
        widget.setAttribute("signed-url", signedUrl);
        widget.setAttribute("variant", "expanded");
        widget.setAttribute("dynamic-variables", JSON.stringify(dynamicVariables));
        widget.setAttribute("avatar-orb-color-1", "#1d4e4b");
        widget.setAttribute("avatar-orb-color-2", "#d4935a");
        widget.setAttribute("start-call-text", "Connect Mic & Start Call");
        widget.setAttribute("end-call-text", "End Call");
        widget.setAttribute("listening-text", "Listening...");
        widget.setAttribute("speaking-text", "Assistant speaking");
        if (overridePrompt) {
          widget.setAttribute("override-prompt", overridePrompt);
        }
        if (overrideFirstMessage) {
          widget.setAttribute("override-first-message", overrideFirstMessage);
        }

        Object.assign(widget.style, {
          display: "block",
          width: "100%",
          minHeight: "620px",
        });

        containerRef.current.appendChild(widget);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load ElevenLabs voice widget.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void mountWidget();

    return () => {
      cancelled = true;
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [dynamicVariables, overrideFirstMessage, overridePrompt, signedUrl]);

  return (
    <div className={cn("relative", className)}>
      {loading ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[1.5rem] bg-[#fffdf9]/90">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading ElevenLabs voice widget...
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-[1.5rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div ref={containerRef} className={cn(error ? "hidden" : "block")} />
    </div>
  );
}
