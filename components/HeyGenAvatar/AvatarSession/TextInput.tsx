import { TaskType, TaskMode } from "@heygen/streaming-avatar";
import React, { useCallback, useEffect, useState } from "react";
import { usePrevious } from "ahooks";
import { Select, SelectItem } from "@heroui/select";
import { Button } from "@heroui/button";
import { Send } from "lucide-react";
import { useTextChat } from "../logic/useTextChat";
import { Input } from "@heroui/input";
import { useConversationState } from "../logic/useConversationState";

export const TextInput: React.FC = () => {
  const { sendMessage, sendMessageSync, repeatMessage, repeatMessageSync } =
    useTextChat();
  const { startListening, stopListening } = useConversationState();
  const [taskType, setTaskType] = useState<TaskType>(TaskType.REPEAT);
  const [taskMode, setTaskMode] = useState<TaskMode>(TaskMode.SYNC);
  const [message, setMessage] = useState("");

  const handleSend = useCallback(() => {
    if (message.trim() === "") {
      return;
    }
    if (taskType === TaskType.TALK) {
      taskMode === TaskMode.SYNC
        ? sendMessageSync(message)
        : sendMessage(message);
    } else {
      taskMode === TaskMode.SYNC
        ? repeatMessageSync(message)
        : repeatMessage(message);
    }
    setMessage("");
  }, [
    taskType,
    taskMode,
    message,
    sendMessage,
    sendMessageSync,
    repeatMessage,
    repeatMessageSync,
  ]);

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
        selectedKeys={[TaskType.REPEAT]}
        onSelectionChange={(keys) => {
          const selectedKey = Array.from(keys)[0] as TaskType;
          setTaskType(selectedKey);
        }}
        size="sm"
        className="w-48"
      >
        <SelectItem key={TaskType.REPEAT}>
          {TaskType.REPEAT.toUpperCase()}
        </SelectItem>
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
        {Object.values(TaskMode).map((option) => (
          <SelectItem key={option}>{option.toUpperCase()}</SelectItem>
        ))}
      </Select>
      <Input
        className="w-full"
        placeholder={`Type something for the avatar to ${taskType === TaskType.REPEAT ? "repeat" : "respond"}...`}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <Button isIconOnly color="primary" onClick={handleSend}>
        <Send size={20} />
      </Button>
    </div>
  );
};
