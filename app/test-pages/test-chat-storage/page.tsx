"use client";

import { useState } from "react";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Input } from "@heroui/input";
import { type ChatMessage } from "@/types";

/**
 * CHAT STORAGE TEST PAGE
 * 
 * This page provides a comprehensive testing interface for the chat storage system.
 * It allows administrators to test all chat storage API endpoints with proper
 * browser-based authentication.
 * 
 * Features:
 * - Test session creation and saving
 * - List existing sessions with filtering
 * - Retrieve individual sessions
 * - Delete sessions for cleanup
 * - Display detailed API responses
 * - Handle authentication automatically through browser cookies
 */

interface TestResult {
  operation: string;
  success: boolean;
  data?: any;
  error?: string;
  timestamp: string;
}

export default function TestChatStoragePage() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [testSessionId, setTestSessionId] = useState(`test_${Date.now()}`);

  // Helper function to add test results
  const addResult = (operation: string, success: boolean, data?: any, error?: string) => {
    const result: TestResult = {
      operation,
      success,
      data,
      error,
      timestamp: new Date().toLocaleTimeString(),
    };
    setResults(prev => [result, ...prev]);
  };

  // Generate sample chat messages for testing
  const generateTestMessages = (): ChatMessage[] => [
    {
      role: "user",
      content: "Hello! This is a test message for the chat storage system.",
      timestamp: Date.now() - 30000,
    },
    {
      role: "assistant",
      content: "Hi there! I'm responding to test the chat storage functionality. This message should be saved to S3.",
      timestamp: Date.now() - 25000,
    },
    {
      role: "user", 
      content: "Can you tell me more about how the storage system works?",
      timestamp: Date.now() - 20000,
    },
    {
      role: "assistant",
      content: "The chat storage system saves conversations to S3 as JSON files and caches session metadata in IndexedDB for quick lookups. Each session includes full conversation history and metadata.",
      timestamp: Date.now() - 15000,
    },
    {
      role: "user",
      content: "That's great! This test should verify everything is working correctly.",
      timestamp: Date.now() - 10000,
    },
    {
      role: "assistant",
      content: "Absolutely! If you can see this conversation saved and retrieved, then the chat storage system is functioning properly.",
      timestamp: Date.now() - 5000,
    },
  ];

  // Test 1: Save a chat session
  const testSaveSession = async () => {
    setIsLoading(true);
    try {
      const testData = {
        sessionId: testSessionId,
        avatarId: "test-avatar-001",
        avatarName: "Chat Storage Test Avatar",
        messages: generateTestMessages(),
        userId: "test-user-123",
        userName: "Test User",
        isKioskMode: true,
        location: "Test Location - Chat Storage Verification",
      };

      const response = await fetch("/api/chat/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(testData),
        credentials: "include", // Include cookies for authentication
      });

      const result = await response.json();
      
      if (response.ok && result.success) {
        addResult("Save Session", true, result);
      } else {
        addResult("Save Session", false, result, result.error || "Unknown error");
      }
    } catch (error) {
      addResult("Save Session", false, null, error instanceof Error ? error.message : "Network error");
    } finally {
      setIsLoading(false);
    }
  };

  // Test 2: List all sessions
  const testListSessions = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/chat/list", {
        credentials: "include",
      });

      const result = await response.json();
      
      if (response.ok && result.success) {
        addResult("List Sessions", true, result);
      } else {
        addResult("List Sessions", false, result, result.error || "Unknown error");
      }
    } catch (error) {
      addResult("List Sessions", false, null, error instanceof Error ? error.message : "Network error");
    } finally {
      setIsLoading(false);
    }
  };

  // Test 3: Get specific session
  const testGetSession = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/chat/get?sessionId=${testSessionId}`, {
        credentials: "include",
      });

      const result = await response.json();
      
      if (response.ok && result.success) {
        addResult("Get Session", true, result);
      } else {
        addResult("Get Session", false, result, result.error || "Unknown error");
      }
    } catch (error) {
      addResult("Get Session", false, null, error instanceof Error ? error.message : "Network error");
    } finally {
      setIsLoading(false);
    }
  };

  // Test 4: Delete session
  const testDeleteSession = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/chat/delete?sessionId=${testSessionId}`, {
        method: "DELETE",
        credentials: "include",
      });

      const result = await response.json();
      
      if (response.ok && result.success) {
        addResult("Delete Session", true, result);
      } else {
        addResult("Delete Session", false, result, result.error || "Unknown error");
      }
    } catch (error) {
      addResult("Delete Session", false, null, error instanceof Error ? error.message : "Network error");
    } finally {
      setIsLoading(false);
    }
  };

  // Test 5: Run full test suite
  const runFullTestSuite = async () => {
    // Generate new session ID for full test
    const newSessionId = `test_full_suite_${Date.now()}`;
    setTestSessionId(newSessionId);
    
    setResults([]); // Clear previous results
    
    // Run tests in sequence
    await testSaveSession();
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait between tests
    
    await testListSessions();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await testGetSession();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await testDeleteSession();
  };

  // Clear all results
  const clearResults = () => {
    setResults([]);
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Chat Storage System Test</h1>
        <p className="text-gray-600">
          This page tests all chat storage API endpoints to verify the system is working correctly.
          You must be logged in as an admin to run these tests.
        </p>
      </div>

      {/* Session ID Configuration */}
      <Card className="mb-6">
        <CardHeader>
          <h2 className="text-xl font-semibold">Test Configuration</h2>
        </CardHeader>
        <CardBody>
          <div className="flex gap-4 items-end">
            <Input
              label="Test Session ID"
              value={testSessionId}
              onChange={(e) => setTestSessionId(e.target.value)}
              className="flex-1"
              description="Unique identifier for the test session"
            />
            <Button
              onClick={() => setTestSessionId(`test_${Date.now()}`)}
              variant="bordered"
            >
              Generate New ID
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Test Controls */}
      <Card className="mb-6">
        <CardHeader>
          <h2 className="text-xl font-semibold">Test Controls</h2>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Button
              onClick={testSaveSession}
              disabled={isLoading}
              color="primary"
            >
              Test Save Session
            </Button>
            <Button
              onClick={testListSessions}
              disabled={isLoading}
              color="secondary"
            >
              Test List Sessions
            </Button>
            <Button
              onClick={testGetSession}
              disabled={isLoading}
              color="success"
            >
              Test Get Session
            </Button>
            <Button
              onClick={testDeleteSession}
              disabled={isLoading}
              color="danger"
            >
              Test Delete Session
            </Button>
            <Button
              onClick={runFullTestSuite}
              disabled={isLoading}
              color="warning"
              className="md:col-span-2"
            >
              Run Full Test Suite
            </Button>
            <Button
              onClick={clearResults}
              disabled={isLoading}
              variant="bordered"
            >
              Clear Results
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Test Results */}
      <Card>
        <CardHeader className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Test Results</h2>
          <Chip size="sm" variant="bordered">
            {results.length} tests run
          </Chip>
        </CardHeader>
        <CardBody>
          {results.length === 0 ? (
            <p className="text-gray-500 italic">No tests run yet. Click a test button above to begin.</p>
          ) : (
            <div className="space-y-4">
              {results.map((result, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg border-l-4 ${
                    result.success 
                      ? "bg-green-50 border-green-500" 
                      : "bg-red-50 border-red-500"
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold">{result.operation}</h3>
                    <div className="flex gap-2 items-center">
                      <Chip
                        size="sm"
                        color={result.success ? "success" : "danger"}
                        variant="flat"
                      >
                        {result.success ? "SUCCESS" : "FAILED"}
                      </Chip>
                      <span className="text-xs text-gray-500">{result.timestamp}</span>
                    </div>
                  </div>
                  
                  {result.error && (
                    <p className="text-red-600 text-sm mb-2">
                      <strong>Error:</strong> {result.error}
                    </p>
                  )}
                  
                  {result.data && (
                    <details className="text-sm">
                      <summary className="cursor-pointer text-gray-600 hover:text-gray-800">
                        View response data
                      </summary>
                      <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto">
                        {JSON.stringify(result.data, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
} 