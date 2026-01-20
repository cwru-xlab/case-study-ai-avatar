import React from "react";

import { useVoiceChat } from "../logic/useVoiceChat";
import { Button } from "@heroui/button";
import { LoaderCircle, Mic, MicOff } from "lucide-react";
import { useConversationState } from "../logic/useConversationState";

export const AudioInput: React.FC = () => {
  const { muteInputAudio, unmuteInputAudio, isMuted, isVoiceChatLoading } =
    useVoiceChat();
  const { isUserTalking } = useConversationState();

  const handleMuteClick = () => {
    if (isMuted) {
      unmuteInputAudio();
    } else {
      muteInputAudio();
    }
  };

  return (
    <div>
      <Button
        isIconOnly
        color="primary"
        className="relative"
        disabled={isVoiceChatLoading}
        onClick={handleMuteClick}
      >
        <div
          className={`absolute left-0 top-0 rounded-lg border-2 border-[#7559FF] w-full h-full ${isUserTalking ? "animate-ping" : ""}`}
        />
        {isVoiceChatLoading ? (
          <LoaderCircle className="animate-spin" size={20} />
        ) : isMuted ? (
          <MicOff size={20} />
        ) : (
          <Mic size={20} />
        )}
      </Button>
    </div>
  );
};
