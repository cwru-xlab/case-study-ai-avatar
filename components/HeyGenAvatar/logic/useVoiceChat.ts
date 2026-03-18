import { useCallback } from "react";
import { useStreamingAvatarContext } from "./context";

export const useVoiceChat = () => {
  const { sessionRef, isMuted, isVoiceChatLoading, isVoiceChatActive } =
    useStreamingAvatarContext();

  const startVoiceChat = useCallback(
    async (_isInputAudioMuted?: boolean) => {
      if (!sessionRef.current) return;
      await sessionRef.current.voiceChat.start();
    },
    [sessionRef],
  );

  const stopVoiceChat = useCallback(() => {
    if (!sessionRef.current) return;
    sessionRef.current.voiceChat.stop();
  }, [sessionRef]);

  const muteInputAudio = useCallback(async () => {
    if (!sessionRef.current) return;
    await sessionRef.current.voiceChat.mute();
  }, [sessionRef]);

  const unmuteInputAudio = useCallback(async () => {
    if (!sessionRef.current) return;
    await sessionRef.current.voiceChat.unmute();
  }, [sessionRef]);

  return {
    startVoiceChat,
    stopVoiceChat,
    muteInputAudio,
    unmuteInputAudio,
    isMuted,
    isVoiceChatActive,
    isVoiceChatLoading,
  };
};
