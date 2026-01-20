"use client";

// SECURITY: Only show this page in development mode
if (typeof window !== "undefined" && process.env.NODE_ENV !== "development") {
  throw new Error("S3 Permissions Test is only available in development mode");
}

import { useState } from "react";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";

/**
 * S3 PERMISSIONS TEST PAGE
 *
 * This page tests specific S3 permissions to help debug
 * the SignatureDoesNotMatch issues we're seeing.
 */

interface TestResult {
  operation: string;
  success: boolean;
  data?: any;
  error?: string;
  timestamp: string;
}

export default function TestS3PermissionsPage() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Helper function to add test results
  const addResult = (
    operation: string,
    success: boolean,
    data?: any,
    error?: string
  ) => {
    const result: TestResult = {
      operation,
      success,
      data,
      error,
      timestamp: new Date().toLocaleTimeString(),
    };
    setResults((prev) => [result, ...prev]);
  };

  // Test 1: Basic list operation (we know this works)
  const testListPermissions = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/chat/list", {
        credentials: "include",
      });

      const result = await response.json();

      if (response.ok && result.success) {
        addResult("List Bucket (chats/)", true, result);
      } else {
        addResult(
          "List Bucket (chats/)",
          false,
          result,
          result.error || "Unknown error"
        );
      }
    } catch (error) {
      addResult(
        "List Bucket (chats/)",
        false,
        null,
        error instanceof Error ? error.message : "Network error"
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Test 2: Test if we can save a very simple object
  const testMinimalSave = async () => {
    setIsLoading(true);
    try {
      const testData = {
        sessionId: `permission_test_${Date.now()}`,
        avatarId: "test",
        avatarName: "Test",
        messages: [
          {
            role: "user",
            content: "test",
            timestamp: Date.now(),
          },
        ],
      };

      const response = await fetch("/api/chat/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(testData),
        credentials: "include",
      });

      const result = await response.json();

      if (response.ok && result.success) {
        addResult("Put Object (minimal)", true, result);
      } else {
        addResult(
          "Put Object (minimal)",
          false,
          result,
          result.error || "Unknown error"
        );
      }
    } catch (error) {
      addResult(
        "Put Object (minimal)",
        false,
        null,
        error instanceof Error ? error.message : "Network error"
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Test 3: Check current environment variables
  const testEnvironmentInfo = async () => {
    setIsLoading(true);
    try {
      // This will show us what environment info we can gather
      const envInfo = {
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        location: window.location.href,
      };

      addResult("Environment Info", true, envInfo);
    } catch (error) {
      addResult(
        "Environment Info",
        false,
        null,
        error instanceof Error ? error.message : "Unknown error"
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Clear all results
  const clearResults = () => {
    setResults([]);
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">S3 Permissions Diagnostic</h1>
        <p className="text-gray-600">
          This page helps diagnose S3 permission issues by testing specific
          operations. We know List works, so lets see what else we can do.
        </p>
      </div>

      {/* Test Controls */}
      <Card className="mb-6">
        <CardHeader>
          <h2 className="text-xl font-semibold">Permission Tests</h2>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button
              onClick={testListPermissions}
              disabled={isLoading}
              color="primary"
            >
              Test List (Known Working)
            </Button>
            <Button
              onClick={testMinimalSave}
              disabled={isLoading}
              color="secondary"
            >
              Test Put Object (Minimal)
            </Button>
            <Button
              onClick={testEnvironmentInfo}
              disabled={isLoading}
              color="success"
            >
              Check Environment
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

      {/* AWS IAM Policy Suggestion */}
      <Card className="mb-6">
        <CardHeader>
          <h2 className="text-xl font-semibold">Expected S3 Permissions</h2>
        </CardHeader>
        <CardBody>
          <p className="text-sm text-gray-600 mb-4">
            Your AWS IAM user/role needs these permissions for the chat storage
            to work:
          </p>
          <pre className="bg-gray-100 p-4 rounded text-xs overflow-auto">
            {`{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:ListBucket",
        "s3:GetBucketLocation"
      ],
      "Resource": "arn:aws:s3:::ai-avatar-kiosk"
    },
    {
      "Effect": "Allow", 
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::ai-avatar-kiosk/*"
    }
  ]
}`}
          </pre>
        </CardBody>
      </Card>

      {/* Test Results */}
      <Card>
        <CardHeader className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Diagnostic Results</h2>
          <Chip size="sm" variant="bordered">
            {results.length} tests run
          </Chip>
        </CardHeader>
        <CardBody>
          {results.length === 0 ? (
            <p className="text-gray-500 italic">
              No tests run yet. Click a test button above to begin.
            </p>
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
                      <span className="text-xs text-gray-500">
                        {result.timestamp}
                      </span>
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
