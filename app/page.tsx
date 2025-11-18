"use client";

import { RealtimeMessage } from "@/components/realtime-message";
import { getDesktopURL } from "@/lib/e2b/utils";
import { useScrollToBottom } from "@/lib/use-scroll-to-bottom";
import {
  useEffect,
  useRef,
  useSyncExternalStore,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { Input } from "@/components/input";
import { toast } from "sonner";
import { AISDKLogo } from "@/components/icons";
import { PromptSuggestions } from "@/components/prompt-suggestions";
import { RealtimeSession } from "@/lib/realtime-session";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default function Chat() {
  const [desktopContainerRef, desktopEndRef] = useScrollToBottom();
  const [mobileContainerRef, mobileEndRef] = useScrollToBottom();

  const sessionRef = useRef<RealtimeSession | undefined>(undefined);

  if (!sessionRef.current) {
    sessionRef.current = new RealtimeSession({
      api: "/api/chat-ws",
      onError: (error) => {
        console.error(error);
        toast.error("There was an error", {
          description: "Please try again later.",
          richColors: true,
          position: "top-center",
        });
      },
    });
  }

  const session = sessionRef.current;

  const state = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );

  const { messages, input, status, isInitializing, streamUrl } = state;
  const isLoading = status !== "ready";

  const handleInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    session.setInput(e.target.value);
  };

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    session.sendMessage(session.getSnapshot().input, { clearInput: true });
  };

  const handlePromptSubmit = (prompt: string) => {
    session.sendMessage(prompt);
  };

  const refreshDesktop = async () => {
    try {
      session.setInitializing(true);
      const snapshot = session.getSnapshot();
      const { streamUrl, id } = await getDesktopURL(snapshot.sandboxId || undefined);
      session.updateDesktop({ streamUrl, sandboxId: id });
    } catch (err) {
      console.error("Failed to refresh desktop:", err);
    } finally {
      session.setInitializing(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        session.setInitializing(true);
        const { streamUrl, id } = await getDesktopURL(undefined);
        session.updateDesktop({ streamUrl, sandboxId: id });
      } catch (err) {
        console.error("Failed to initialize desktop:", err);
        toast.error("Failed to initialize desktop");
      } finally {
        session.setInitializing(false);
      }
    };

    init();
  }, [session]);

  useEffect(() => {
    const { sandboxId } = session.getSnapshot();
    if (!sandboxId) return;

    const killDesktop = () => {
      const currentSandboxId = session.getSnapshot().sandboxId;
      if (!currentSandboxId) return;
      navigator.sendBeacon(
        `/api/kill-desktop?sandboxId=${encodeURIComponent(currentSandboxId)}`,
      );
    };

    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

    if (isIOS || isSafari) {
      window.addEventListener("pagehide", killDesktop);
      return () => {
        window.removeEventListener("pagehide", killDesktop);
        killDesktop();
      };
    } else {
      window.addEventListener("beforeunload", killDesktop);
      return () => {
        window.removeEventListener("beforeunload", killDesktop);
        killDesktop();
      };
    }
  }, [session, state.sandboxId]);

  return (
    <div className="flex h-dvh relative">
      <div className="hidden xl:flex w-full">
        <div className="w-96 flex flex-col border-r border-border">
          <div className="bg-background py-2 px-4 flex justify-between items-center">
            <AISDKLogo />
          </div>

          <div
            className="flex-1 space-y-6 py-4 overflow-y-auto px-4 hide-scrollbar"
            ref={desktopContainerRef}
          >
            {messages.map((message, i) => (
              <RealtimeMessage
                message={message}
                key={message.id}
                isLoading={isLoading}
                status={status}
                isLatestMessage={i === messages.length - 1}
              />
            ))}
            <div ref={desktopEndRef} className="pb-2" />
          </div>

          {messages.length === 0 && (
            <PromptSuggestions
              disabled={isInitializing}
              submitPrompt={handlePromptSubmit}
            />
          )}
          <div className="bg-background">
            <form onSubmit={handleFormSubmit} className="p-4">
              <Input
                handleInputChange={handleInputChange}
                input={input}
                isInitializing={isInitializing}
                isLoading={isLoading}
                status={status}
                stop={() => session.stop()}
              />
            </form>
          </div>
        </div>

        <div className="flex-1 bg-black relative flex items-center justify-center">
          {streamUrl ? (
            <iframe
              src={streamUrl}
              className="w-full h-full"
              style={{
                transformOrigin: "center",
                width: "100%",
                height: "100%",
              }}
              allow="autoplay; clipboard-read; clipboard-write; camera; microphone; geolocation"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-white">
              {isInitializing ? "Initializing desktop..." : "Loading stream..."}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col w-full xl:hidden">
        <div className="bg-background py-2 px-4 flex justify-between items-center">
          <AISDKLogo />
        </div>

        <div
          className="flex-1 space-y-6 py-4 overflow-y-auto px-4 hide-scrollbar"
          ref={mobileContainerRef}
        >
          {messages.map((message, i) => (
            <RealtimeMessage
              message={message}
              key={message.id}
              isLoading={isLoading}
              status={status}
              isLatestMessage={i === messages.length - 1}
            />
          ))}
          <div ref={mobileEndRef} className="pb-2" />
        </div>

        {messages.length === 0 && (
          <PromptSuggestions
            disabled={isInitializing}
            submitPrompt={handlePromptSubmit}
          />
        )}
        <div className="bg-background">
          <form onSubmit={handleFormSubmit} className="p-4">
            <Input
              handleInputChange={handleInputChange}
              input={input}
              isInitializing={isInitializing}
              isLoading={isLoading}
              status={status}
              stop={() => session.stop()}
            />
          </form>
        </div>
      </div>
    </div>
  );
}
