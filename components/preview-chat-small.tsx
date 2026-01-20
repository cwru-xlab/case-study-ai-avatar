"use client";

import { Card, CardBody } from "@heroui/card";
import { Button } from "@heroui/button";
import { ScrollShadow } from "@heroui/scroll-shadow";
import { Tooltip } from "@heroui/tooltip";
import { MessageCircle, User, Bot, HelpCircle } from "lucide-react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

interface PreviewChatSmallProps {
  messages: ChatMessage[];
  onOpenFullChat: () => void;
  disabled?: boolean;
}

export default function PreviewChatSmall({
  messages,
  onOpenFullChat,
  disabled = false,
}: PreviewChatSmallProps) {
  const recentMessages = messages.slice(-3); // Show only last 3 messages

  if (disabled) {
    return (
      <div className="p-4 bg-default-100 border border-default-200 rounded-lg text-center text-default-500">
        <MessageCircle className="w-6 h-6 mx-auto mb-2 opacity-50" />
        <p className="text-sm">
          Chat preview available when editing existing avatars
        </p>
      </div>
    );
  }

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow duration-200"
      isPressable
      onPress={onOpenFullChat}
    >
      <CardBody className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <MessageCircle className="w-4 h-4" />
          <p className="text-sm font-medium">Chat Preview</p>
          <Tooltip
            content="Chat always uses the current system prompt from the text box on the left, even if not saved yet. Test your prompts in real-time!"
            placement="top"
            delay={0}
            closeDelay={0}
            classNames={{
              content: "max-w-xs text-center",
            }}
          >
            <HelpCircle className="w-3 h-3 text-default-400 hover:text-default-600 cursor-help" />
          </Tooltip>
          <div className="ml-auto text-xs">Open Chat</div>
        </div>

        {recentMessages.length === 0 ? (
          <div className="text-center py-4 text-default-500">
            <p className="text-sm">No messages yet</p>
            <p className="text-xs">Click to start chatting with this avatar</p>
          </div>
        ) : (
          <ScrollShadow className="max-h-32" hideScrollBar>
            <div className="space-y-2">
              {recentMessages.map((message, index) => (
                <div
                  key={index}
                  className={`flex items-start gap-2 text-xs ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {message.role === "assistant" && (
                    <Bot className="w-3 h-3 mt-0.5 text-primary flex-shrink-0" />
                  )}
                  <div
                    className={`max-w-[80%] p-2 rounded-lg ${
                      message.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-default-100 text-default-700"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">
                      {message.content.length > 100
                        ? `${message.content.slice(0, 100)}...`
                        : message.content}
                    </p>
                  </div>
                  {message.role === "user" && (
                    <User className="w-3 h-3 mt-0.5 text-primary flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </ScrollShadow>
        )}

        {recentMessages.length > 0 && (
          <div className="mt-2 pt-2 border-t border-default-200">
            <p className="text-xs text-default-500 text-center">
              {messages.length} message{messages.length !== 1 ? "s" : ""} •
              Click to view all
            </p>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
