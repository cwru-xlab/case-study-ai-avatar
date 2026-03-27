import { useCallback } from "react";
import { useStreamingAvatarContext } from "./context";

export const useInterrupt = () => {
  const { sessionRef } = useStreamingAvatarContext();

  const interrupt = useCallback(() => {
    if (!sessionRef.current) return;
    sessionRef.current.interrupt();
  }, [sessionRef]);

  return { interrupt };
};
