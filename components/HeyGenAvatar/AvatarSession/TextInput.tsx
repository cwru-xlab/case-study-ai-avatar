import React, { useCallback, useEffect, useState } from "react";
import { usePrevious } from "ahooks";
import { Select, SelectItem } from "@heroui/select";
import { Button } from "@heroui/button";
import { Send } from "lucide-react";
import { useTextChat } from "../logic/useTextChat";
import { Input } from "@heroui/input";
import { useConversationState } from "../logic/useConversationState";

type TaskType = "repeat";
type TaskMode = "sync" | "async";

export const TextInput: React.FC = () => {
  const { repeatMessage, repeatMessageSync } = useTextChat();
  const { startListening, stopListening } = useConversationState();
  const [taskType] = useState<TaskType>("repeat");
  const [taskMode, setTaskMode] = useState<TaskMode>("sync");
  const [message, setMessage] = useState("");

  const handleSend = useCallback(() => {
    if (message.trim() === "") return;

    if (taskMode === "sync") {
      repeatMessageSync(message);
    } else {
      repeatMessage(message);
    }
    setMessage("");
  }, [taskMode, message, repeatMessage, repeatMessageSync]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter") {
        handleSend();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSend]);

  const previousText = usePrevious(message);

  useEffect(() => {
    if (!previousText && message) {
      startListening();
    } else if (previousText && !message) {
      stopListening();
    }
  }, [message, previousText, startListening, stopListening]);

  return (
    <div className="flex flex-row gap-2 items-center w-full">
      <Select
        label="Task Type"
        placeholder="Select task type"
        selectedKeys={["repeat"]}
        isDisabled
        size="sm"
        className="w-48"
      >
        <SelectItem key="repeat">REPEAT</SelectItem>
      </Select>
      <Select
        label="Task Mode"
        placeholder="Select task mode"
        selectedKeys={[taskMode]}
        onSelectionChange={(keys) => {
          const selectedKey = Array.from(keys)[0] as TaskMode;
          setTaskMode(selectedKey);
        }}
        size="sm"
        className="w-48"
      >
        <SelectItem key="sync">SYNC</SelectItem>
        <SelectItem key="async">ASYNC</SelectItem>
      </Select>
      <Input
        className="w-full"
        placeholder={`Type something for the avatar to ${taskType === "repeat" ? "repeat" : "respond"}...`}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <Button isIconOnly color="primary" onClick={handleSend}>
        <Send size={20} />
      </Button>
    </div>
  );
};
