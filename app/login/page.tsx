"use client";

import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { University } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const { login, loginWithCWRU } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    const result = await login(email, password);

    if (result.success) {
      // Login successful, redirect based on role
      const meResponse = await fetch("/api/auth/me");
      const meData = await meResponse.json();
      if (meData.user?.role === "student") {
        window.location.href = "/student-cases";
      } else {
        window.location.href = "/";
      }
    } else {
      // Login failed, show error
      setError(result.error || "Login failed");
    }

    setIsLoading(false);
  };

  const handleCWRULogin = () => {
    loginWithCWRU();
  };

  // Check for error in URL params (from SSO callback)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlError = urlParams.get("error");
    if (urlError) {
      setError(decodeURIComponent(urlError));
    }
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-full max-w-md p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold">Sign In</h1>
          <p className="text-gray-600 mt-2">
            Access your account with your credentials
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
              {error}
            </div>
          )}

          <Input
            label="Email"
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <Input
            label="Password"
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          <Button
            type="submit"
            className="w-full"
            color="primary"
            isLoading={isLoading}
          >
            {isLoading ? "Signing In..." : "Sign In"}
          </Button>
        </form>

        <div className="mt-4">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white dark:bg-gray-800 px-2 text-gray-500">
                Or continue with
              </span>
            </div>
          </div>

          <Button
            type="button"
            variant="bordered"
            className="w-full mt-4"
            onClick={handleCWRULogin}
          >
            <University />
            Sign in with CWRU SSO
          </Button>
        </div>

        <div className="mt-6 text-center text-sm text-gray-600">
          <p>JWT authentication is active. Choose your login method:</p>
          <div className="mt-3 space-y-2 text-left bg-gray-100 dark:bg-gray-700 p-3 rounded">
            <p>
              <strong>Test Email Login:</strong>
            </p>
            <p className="ml-4">
              <strong>Admin:</strong> admin@example.com / admin123
            </p>
            <p className="ml-4">
              <strong>User:</strong> user@example.com / user123
            </p>
            <p className="ml-4">
              <strong>Student:</strong> student@case.edu / student123
            </p>
            <p className="mt-2">
              <strong>CWRU SSO:</strong> Use your Case Western Reserve
              University credentials
            </p>
          </div>
          <p className="mt-3">
            Try accessing other pages without logging in - you&apos;ll be
            redirected here.
          </p>
        </div>
      </div>
    </div>
  );
}
