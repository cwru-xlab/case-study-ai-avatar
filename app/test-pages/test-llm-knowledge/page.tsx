"use client";

import { useState } from "react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Snippet } from "@heroui/snippet";
import { Code } from "@heroui/code";
import { Divider } from "@heroui/divider";
import { title, subtitle } from "@/components/primitives";
import ApiDemo from "@/components/api-demo";
import { BrainCircuit, Search, Activity } from "lucide-react";
import { Chip } from "@heroui/chip";

interface SearchResult {
  success: boolean;
  context?: {
    chunks: Array<{
      text: string;
      source: string;
      score: number;
      metadata: {
        avatarId?: string;
        chunkIndex?: number;
        originalText?: string;
        source?: string;
        sourceId?: string;
        title?: string;
        totalChunks?: number;
        uploadDate?: string;
      };
    }>;
    sources: string[];
  };
  error?: string;
  details?: string;
}

export default function TestLLMKnowledge() {
  const [searchQuery, setSearchQuery] = useState("What is artificial intelligence?");
  const [avatarId, setAvatarId] = useState("");
  const [topK, setTopK] = useState(5);
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const testKnowledgeSearch = async () => {
    if (!searchQuery.trim()) {
      setError("Please enter a search query");
      return;
    }

    setSearching(true);
    setError(null);
    setSearchResult(null);

    try {
      const response = await fetch("/api/knowledge/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: searchQuery,
          avatarId: avatarId || undefined,
          topK: topK,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(`HTTP ${response.status}: ${result.error || 'Unknown error'}`);
        return;
      }

      setSearchResult(result);
    } catch (err) {
      setError(`Network error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      console.error("Knowledge search error:", err);
    } finally {
      setSearching(false);
    }
  };

  return (
    <section className="flex flex-col items-center justify-center gap-6 py-8 md:py-10 max-w-6xl mx-auto">
      <div className="text-center">
        <h1 className={title()}>LLM & Knowledge Test</h1>
        <p className={subtitle({ class: "mt-4" })}>
          Test LLM API endpoints and knowledge search functionality
        </p>
      </div>

      {/* Knowledge Search Test */}
      <Card className="w-full">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Search className="text-primary" size={24} />
            <h2 className="text-xl font-semibold">Knowledge Search Test</h2>
          </div>
        </CardHeader>
        <CardBody>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="Search Query"
                placeholder="What would you like to search for?"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                disabled={searching}
              />
              <Input
                label="Avatar ID (optional)"
                placeholder="Leave empty for global search"
                value={avatarId}
                onChange={(e) => setAvatarId(e.target.value)}
                disabled={searching}
              />
              <Input
                label="Top K Results"
                type="number"
                min="1"
                max="20"
                value={topK.toString()}
                onChange={(e) => setTopK(parseInt(e.target.value) || 5)}
                disabled={searching}
              />
            </div>

            <Button
              color="primary"
              onPress={testKnowledgeSearch}
              disabled={searching || !searchQuery.trim()}
              className="w-full md:w-auto"
            >
              {searching ? "Searching..." : "Search Knowledge Base"}
            </Button>

            {error && (
              <div className="p-4 bg-danger-50 dark:bg-danger-900/20 rounded-lg border border-danger-200 dark:border-danger-700">
                <p className="text-danger-700 dark:text-danger-300 text-sm">
                  <strong>Error:</strong> {error}
                </p>
              </div>
            )}

            {searchResult && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-success-600">
                  <Activity size={16} />
                  <span className="text-sm font-medium">Search completed successfully</span>
                </div>

                {searchResult.context?.chunks && searchResult.context.chunks.length > 0 ? (
                  <div className="space-y-3">
                    <h3 className="font-semibold">Search Results ({searchResult.context.chunks.length}):</h3>
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-default-600 mb-2">Sources Found:</h4>
                      <div className="flex flex-wrap gap-2">
                        {searchResult.context.sources.map((source, index) => (
                          <Chip key={index} size="sm" variant="bordered" color="secondary" >
                            {source}
                          </Chip>
                        ))}
                      </div>
                    </div>
                    {searchResult.context.chunks.map((chunk, index) => (
                      <Card key={index} className="bg-default-50 dark:bg-default-900/50">
                        <CardBody className="p-4">
                          <div className="space-y-2">
                            <div className="flex flex-wrap gap-2 text-xs">
                              <Chip size="sm" variant="flat" >
                                {chunk.source}
                              </Chip>
                              {chunk.metadata.avatarId && (
                                <Chip size="sm" variant="flat" color="primary" >
                                  Avatar: {chunk.metadata.avatarId}
                                </Chip>
                              )}
                              <Chip size="sm" variant="flat" color="success" >
                                Score: {(chunk.score * 100).toFixed(1)}%
                              </Chip>
                              {chunk.metadata.chunkIndex !== undefined && (
                                <Chip size="sm" variant="flat" color="default" >
                                  Chunk: {chunk.metadata.chunkIndex + 1}/{chunk.metadata.totalChunks}
                                </Chip>
                              )}
                              {chunk.metadata.uploadDate && (
                                <Chip size="sm" variant="flat" color="warning" >
                                  {new Date(chunk.metadata.uploadDate).toLocaleDateString()}
                                </Chip>
                              )}
                            </div>
                            <p className="text-sm text-default-700 dark:text-default-300">
                              {chunk.text}
                            </p>
                          </div>
                        </CardBody>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 bg-warning-50 dark:bg-warning-900/20 rounded-lg border border-warning-200 dark:border-warning-700">
                    <p className="text-warning-700 dark:text-warning-300 text-sm">
                      No results found for your query.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      <Divider className="w-full" />

      {/* LLM API Demo */}
      <Card className="w-full">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <BrainCircuit className="text-success" size={24} />
            <h2 className="text-xl font-semibold">LLM API Demo</h2>
          </div>
        </CardHeader>
        <CardBody>
          <ApiDemo />
        </CardBody>
      </Card>

      <div className="mt-8">
        <Snippet hideCopyButton hideSymbol variant="bordered">
          <span>
            Testing endpoints: <Code color="primary">/api/knowledge/search</Code> and{" "}
            <Code color="success">/api/llm/preview</Code>
          </span>
        </Snippet>
      </div>
    </section>
  );
} 