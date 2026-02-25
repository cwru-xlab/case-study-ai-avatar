"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Snippet } from "@heroui/snippet";
import { Code } from "@heroui/code";
import { Button } from "@heroui/button";
import { title, subtitle } from "@/components/primitives";
import ApiDemo from "@/components/api-demo";
import { useAuth } from "@/lib/auth-context";
import Avatar from "boring-avatars";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user?.role === "student") {
      router.replace("/student-cases");
    }
  }, [user, loading, router]);

  const launchKioskMode = () => {
    // Open both kiosk pages in new windows
    const mainDisplay = window.open(
      "/kiosk/main-display",
      "mainDisplay",
      "width=1920,height=1080,location=no,menubar=no,toolbar=no"
    );
    const touchScreen = window.open(
      "/kiosk/touch-screen",
      "touchScreen",
      "width=1280,height=720,location=no,menubar=no,toolbar=no"
    );

    if (!mainDisplay || !touchScreen) {
      alert(
        "Please allow pop-ups for this site to launch kiosk mode properly."
      );
    }
  };

  if (loading) {
    return (
      <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
        <div>Loading...</div>
      </section>
    );
  }

  return (
    <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10">
      <div className="text-center">
        <h1 className={title()}>AI Avatar Kiosk</h1>
        <p className={subtitle({ class: "mt-4" })}>
          Welcome to the authenticated area!
        </p>
      </div>

      {user && (
        <div className="w-full max-w-md p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold mb-4">User Information</h2>
          <div className="space-y-2">
            <p>
              <strong>Name:</strong> {user.name}
            </p>
            <p>
              <strong>Email:</strong> {user.email}
            </p>
            <p>
              <strong>Role:</strong> {user.role}
            </p>
            <p>
              <strong>User ID:</strong> {user.id}
            </p>
            <p>
              <strong>Authentication Provider:</strong>{" "}
              {user.authProvider === "cwru_sso"
                ? "CWRU SSO"
                : user.authProvider === "email"
                  ? "Email/Password"
                  : user.authProvider || "Unknown"}
            </p>
            {user.authProvider === "cwru_sso" && user.studentId && (
              <p>
                <strong>Student ID:</strong> {user.studentId}
              </p>
            )}
          </div>
          <div className="mt-4 text-sm text-gray-600">
            <p>✅ Your JWT token is valid and you are authenticated!</p>
            <p>This page is protected by JWT middleware.</p>
            {user.authProvider === "cwru_sso" && (
              <p>🎓 Authenticated via Case Western Reserve University SSO</p>
            )}
            {user.authProvider === "email" && (
              <p>📧 Authenticated via email and password</p>
            )}
            {user.authProvider &&
              user.authProvider !== "cwru_sso" &&
              user.authProvider !== "email" && (
                <p>🔐 Authenticated via {user.authProvider}</p>
              )}
          </div>
        </div>
      )}

      {/* Launch Kiosk Mode Button - Admin or Kiosk */}
      {(user?.role === "admin" || user?.role === "kiosk") && (
        <div className="mt-6">
          <Button
            color="primary"
            size="lg"
            onPress={launchKioskMode}
            className="px-8 py-3 font-semibold"
          >
            🖥️ Launch Kiosk Mode
          </Button>
          <p className="text-sm text-gray-500 mt-2 text-center">
            Opens main display and touch screen interfaces
          </p>
        </div>
      )}

      {/* Avatar Variants */}
      <div className="flex flex-row gap-4">
        <Avatar name="Alice Paul" variant="beam" size={60} />
        <Avatar name="Alice Paul" variant="bauhaus" size={60} />
        <Avatar name="Alice Paul" variant="marble" size={60} />
        <Avatar name="Alice Paul" variant="pixel" size={60} />
        <Avatar name="Alice Paul" variant="ring" size={60} />
        <Avatar name="Alice Paul" variant="sunset" size={60} />
      </div>

      <div className="mt-8">
        <Snippet hideCopyButton hideSymbol variant="bordered">
          <span>
            JWT Authentication system is active.{" "}
            <Code color="primary">middleware.ts</Code> protects all routes.
          </span>
        </Snippet>
      </div>
    </section>
  );
}
