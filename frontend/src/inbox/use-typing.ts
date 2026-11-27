import { useCallback, useEffect, useRef, useState } from "react";
import { emitTyping } from "../realtime";
import { createTypingController } from "./typing";

export function useTyping(conversationId: string, userId: string, peerId?: string) {
  const [isPeerTyping, setPeerTyping] = useState(false);
  const current = useRef<ReturnType<typeof createTypingController> | null>(null);
  useEffect(() => {
    const controller = createTypingController({
      conversationId,
      userId,
      peerId,
      emit: emitTyping,
      onChange: setPeerTyping,
    });
    current.current = controller;
    function receive(event: Event) {
      const detail = (event as CustomEvent<{ event: string; data: unknown }>).detail;
      if (detail?.event === "disconnect") controller.disconnected();
      if (detail?.event === "conversation:typing" && peerId) controller.receive(detail.data);
    }
    const stop = () => controller.stop();
    const visibility = () => {
      if (document.visibilityState === "hidden") stop();
    };
    window.addEventListener("mxh:realtime", receive);
    window.addEventListener("blur", stop);
    window.addEventListener("pagehide", stop);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("mxh:realtime", receive);
      window.removeEventListener("blur", stop);
      window.removeEventListener("pagehide", stop);
      document.removeEventListener("visibilitychange", visibility);
      controller.dispose();
      if (current.current === controller) current.current = null;
    };
  }, [conversationId, userId, peerId]);
  const changed = useCallback((text: string) => current.current?.changed(text), []);
  const stop = useCallback(() => current.current?.stop(), []);
  return { isPeerTyping, changed, stop };
}
