"use client";

import { useState, useRef } from "react";
import { Button } from "@heroui/button";
import { Snippet } from "@heroui/snippet";
import { Input } from "@heroui/input";

interface StreamMetadata {
  model?: string;
  avatarId?: string;
  userMessage?: string;
  finalLength?: number;
  duration?: number;
}

interface StreamInfo {
  startTime?: string;
  endTime?: string;
  metadata?: StreamMetadata;
}

export default function ApiDemo() {
  const [streamingResponse, setStreamingResponse] = useState<string>("");
  const [streamInfo, setStreamInfo] = useState<StreamInfo>({});
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState(
    "Tell me an interesting fact about artificial intelligence"
  );
  const [systemPrompt, setSystemPrompt] = useState(
    "You are a helpful assistant. Keep your responses concise and engaging. Say mew at the end of your responses."
  );
  const [currentAvatarId, setCurrentAvatarId] = useState<string>("");
  const eventSourceRef = useRef<EventSource | null>(null);

  // Generate a random avatar ID for testing
  const generateRandomAvatarId = () => {
    const avatarIds = [
      "helpful-assistant",
      "creative-writer",
      "technical-expert",
      "friendly-tutor",
      "cat-assistant",
    ];
    return avatarIds[Math.floor(Math.random() * avatarIds.length)];
  };

  const callStreamAPI = async () => {
    if (!message.trim()) {
      setError("Please enter a message");
      return;
    }

    if (!systemPrompt.trim()) {
      setError("Please enter a system prompt");
      return;
    }

    setStreaming(true);
    setError(null);
    setStreamingResponse("");
    setStreamInfo({});

    // Generate a new random avatar ID for each request
    const avatarId = generateRandomAvatarId();
    setCurrentAvatarId(avatarId);

    try {
      // Send the POST request to the preview endpoint
      const response = await fetch("/api/llm/preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: message,
            },
          ],
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

                if (data.type === "start") {
                  console.log("Stream started:", data.message);
                  setStreamInfo((prev) => ({
                    ...prev,
                    startTime: data.timestamp,
                    metadata: { ...data.metadata, avatarId: avatarId },
                  }));
                } else if (data.type === "content") {
                  // Since content is now accumulated, we replace rather than append
                  setStreamingResponse(data.content);
                } else if (data.type === "end") {
                  console.log("Stream ended:", data.message);
                  setStreamInfo((prev) => ({
                    ...prev,
                    endTime: data.timestamp,
                    metadata: { ...prev.metadata, ...data.metadata },
                  }));
                  break;
                } else if (data.type === "error") {
                  setError(data.message);
                  break;
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
    } catch (err) {
      setError("Failed to stream data from API");
      console.error("Streaming Error:", err);
    } finally {
      setStreaming(false);
    }
  };

  const stopStream = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setStreaming(false);
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <div className="mt-8 p-6 border border-gray-200 rounded-lg bg-gray-50 dark:bg-gray-900 dark:border-gray-700">
      <h3 className="text-lg font-semibold mb-4 text-center">
        Avatar System Demo - Preview Mode with Custom System Prompts
      </h3>

      {/* Input for custom message */}
      <div className="mb-4 space-y-4">
        <Input
          label="Message for OpenAI"
          placeholder="Enter your message..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="w-full"
          disabled={streaming}
        />
        <Input
          label="System Prompt (Avatar Preview)"
          placeholder="Enter the system prompt to test..."
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          className="w-full"
          disabled={streaming}
        />
        {currentAvatarId && (
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Current Avatar ID:{" "}
            <span className="font-mono">{currentAvatarId}</span>
          </div>
        )}
      </div>

      <div className="flex gap-3 justify-center mb-4">
        <Button
          color="secondary"
          variant="solid"
          onClick={callStreamAPI}
          isLoading={streaming}
          disabled={false}
        >
          {streaming ? "Streaming..." : "Preview Avatar (Stream)"}
        </Button>
        {streaming && (
          <Button color="danger" variant="bordered" onClick={stopStream}>
            Stop Stream
          </Button>
        )}
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded dark:bg-red-900 dark:border-red-600 dark:text-red-300">
          Error: {error}
        </div>
      )}

      {/* Stream Info and Metadata */}
      {(streamInfo.startTime || streamInfo.metadata) && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded dark:bg-blue-900 dark:border-blue-700">
          <h4 className="font-medium mb-2 text-blue-800 dark:text-blue-200">
            Stream Information:
          </h4>
          <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
            {streamInfo.metadata?.model && (
              <div>
                <strong>Model:</strong> {streamInfo.metadata.model}
              </div>
            )}
            {streamInfo.metadata?.avatarId && (
              <div>
                <strong>Avatar ID:</strong> {streamInfo.metadata.avatarId}
              </div>
            )}
            {streamInfo.startTime && (
              <div>
                <strong>Started:</strong>{" "}
                {formatTimestamp(streamInfo.startTime)}
              </div>
            )}
            {streamInfo.endTime && (
              <div>
                <strong>Completed:</strong>{" "}
                {formatTimestamp(streamInfo.endTime)}
              </div>
            )}
            {streamInfo.metadata?.duration && (
              <div>
                <strong>Duration:</strong> {streamInfo.metadata.duration}ms
              </div>
            )}
            {streamInfo.metadata?.finalLength && (
              <div>
                <strong>Response Length:</strong>{" "}
                {streamInfo.metadata.finalLength} characters
              </div>
            )}
          </div>
        </div>
      )}

      {/* Streaming Response */}
      {streamingResponse && (
        <div className="mt-4">
          <h4 className="font-medium mb-2">OpenAI Streaming Response:</h4>
          <div className="p-4 bg-white border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-600">
            <div className="whitespace-pre-wrap text-sm">
              {streamingResponse}
              {streaming && <span className="animate-pulse">|</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
