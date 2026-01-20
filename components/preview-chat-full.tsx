"use client";

import { useState, useRef, useEffect } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/modal";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { ScrollShadow } from "@heroui/scroll-shadow";
import { Tooltip } from "@heroui/tooltip";
import {
  MessageCircle,
  User,
  Bot,
  Send,
  Trash2,
  X,
  HelpCircle,
  Zap,
} from "lucide-react";
import { addToast } from "@heroui/toast";
import { type ConversationStarter } from "@/types";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

interface PreviewChatFullProps {
  isOpen: boolean;
  onClose: () => void;
  avatarId: string;
  avatarName: string;
  systemPrompt: string;
  conversationStarters?: ConversationStarter[];
  messages: ChatMessage[];
  onMessagesUpdate: (messages: ChatMessage[]) => void;
}

export default function PreviewChatFull({
  isOpen,
  onClose,
  avatarId,
  avatarName,
  systemPrompt,
  conversationStarters = [],
  messages,
  onMessagesUpdate,
}: PreviewChatFullProps) {
  const [newMessage, setNewMessage] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent]);

  const clearChat = () => {
    onMessagesUpdate([]);
    addToast({
      title: "Chat Cleared",
      description: "All messages have been deleted",
      color: "warning",
    });
  };

  const sendMessage = async (messageContent?: string) => {
    const content = messageContent || newMessage.trim();
    if (!content || isStreaming) return;

    const userMessage: ChatMessage = {
      role: "user",
      content: content,
      timestamp: Date.now(),
    };

    // Add user message immediately
    const updatedMessages = [...messages, userMessage];
    onMessagesUpdate(updatedMessages);
    setNewMessage("");
    setIsStreaming(true);
    setStreamingContent("");

    try {
      // Send the POST request to the preview endpoint
      const response = await fetch("/api/llm/preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: updatedMessages.map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
          avatarId: avatarId,
          systemPrompt: systemPrompt,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Check if the response is a stream
      if (response.headers.get("content-type")?.includes("text/event-stream")) {
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error("No reader available");
        }

        let buffer = "";
        let assistantContent = "";

        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.type === "content") {
                  assistantContent = data.content;
                  setStreamingContent(assistantContent);
                } else if (data.type === "end") {
                  // Stream ended, add the final message
                  const assistantMessage: ChatMessage = {
                    role: "assistant",
                    content: assistantContent,
                    timestamp: Date.now(),
                  };
                  onMessagesUpdate([...updatedMessages, assistantMessage]);
                  setStreamingContent("");
                  break;
                } else if (data.type === "error") {
                  throw new Error(data.message);
                }
              } catch (parseError) {
                console.error("Error parsing SSE data:", parseError);
              }
            }
          }
        }
      } else {
        throw new Error("Expected event-stream response");
      }
    } catch (error) {
      console.error("Chat error:", error);
      addToast({
        title: "Chat Error",
        description: "Failed to get response from avatar",
        color: "danger",
      });
    } finally {
      setIsStreaming(false);
      setStreamingContent("");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="3xl"
      scrollBehavior="inside"
      classNames={{
        body: "p-0",
        base: "max-h-[90vh]",
      }}
      isDismissable={false}
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex items-center gap-3 border-b border-default-200">
              <div className="flex items-center gap-3">
                <MessageCircle className="w-5 h-5" />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold">
                      Chat with {avatarName}
                    </h3>
                    <Tooltip
                      content="Uses real-time system prompt from the text box - test your changes instantly!"
                      placement="bottom"
                      delay={0}
                      closeDelay={0}
                      classNames={{
                        content: "max-w-xs text-center",
                      }}
                    >
                      <HelpCircle className="w-4 h-4 text-default-400 hover:text-default-600 cursor-help" />
                    </Tooltip>
                  </div>
                  <p className="text-sm text-default-500">
                    Avatar ID: {avatarId}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {messages.length > 0 && (
                  <Button
                    size="sm"
                    color="danger"
                    onPress={clearChat}
                    startContent={<Trash2 className="w-4 h-4" />}
                  >
                    Clear Chat
                  </Button>
                )}
              </div>
            </ModalHeader>

            <ModalBody className="flex flex-col h-[60vh]">
              {/* Chat Messages */}
              <ScrollShadow className="flex-1 px-4 py-4">
                {messages.length === 0 && !streamingContent && (
                  <div className="flex flex-col items-center justify-center h-full text-default-500 space-y-6">
                    <div className="text-center">
                      <Bot className="w-12 h-12 mb-4 opacity-50 mx-auto" />
                      <p className="text-lg font-medium">
                        Start a conversation
                      </p>
                      <p className="text-sm">
                        Chat with this avatar to test how it responds with your
                        current system prompt
                      </p>
                    </div>

                    {conversationStarters.length > 0 && (
                      <div className="w-full max-w-md space-y-3">
                        <div className="flex items-center gap-2 justify-center">
                          <Zap className="w-4 h-4" />
                          <p className="text-sm font-medium">
                            Conversation Starters
                          </p>
                        </div>
                        <div className="space-y-2">
                          {conversationStarters.map((starter, index) => (
                            <Button
                              key={index}
                              variant="bordered"
                              size="sm"
                              className="w-full justify-start text-left h-auto p-3"
                              onPress={() => sendMessage(starter.question)}
                              isDisabled={isStreaming}
                            >
                              <div className="text-left">
                                <div className="font-medium text-sm">
                                  {starter.title}
                                </div>
                                <div className="text-xs text-default-500 mt-1">
                                  {starter.question.length > 80
                                    ? `${starter.question.slice(0, 80)}...`
                                    : starter.question}
                                </div>
                              </div>
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-4">
                  {messages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex items-start gap-3 ${
                        message.role === "user"
                          ? "justify-end"
                          : "justify-start"
                      }`}
                    >
                      {message.role === "assistant" && (
                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                          <Bot className="w-4 h-4 text-primary-foreground" />
                        </div>
                      )}
                      <div
                        className={`max-w-[75%] p-3 rounded-lg ${
                          message.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-default-100 text-default-700"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">
                          {message.content}
                        </p>
                        <p className="text-xs opacity-60 mt-1">
                          {new Date(message.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                      {message.role === "user" && (
                        <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                          <User className="w-4 h-4 text-secondary-foreground" />
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Streaming message */}
                  {streamingContent && (
                    <div className="flex items-start gap-3 justify-start">
                      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                        <Bot className="w-4 h-4 text-primary-foreground" />
                      </div>
                      <div className="max-w-[75%] p-3 rounded-lg bg-default-100 text-default-700">
                        <p className="whitespace-pre-wrap break-words">
                          {streamingContent}
                          <span className="animate-pulse">|</span>
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                <div ref={messagesEndRef} />
              </ScrollShadow>
            </ModalBody>

            <ModalFooter className="border-t border-default-200 p-4">
              <div className="flex w-full gap-2">
                <Input
                  placeholder="Type your message..."
                  value={newMessage}
                  onValueChange={setNewMessage}
                  onKeyDown={handleKeyPress}
                  disabled={isStreaming}
                  className="flex-1"
                  endContent={
                    <Button
                      size="sm"
                      color="primary"
                      variant="flat"
                      onPress={() => sendMessage()}
                      isLoading={isStreaming}
                      isDisabled={!newMessage.trim() || isStreaming}
                      isIconOnly
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  }
                />
              </div>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
