"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Users, Calendar, CheckCircle, AlertCircle, LogIn } from "lucide-react";
import { addToast } from "@heroui/toast";
import type { Cohort } from "@/types/cohort";
import { ACCESS_MODE_LABELS } from "@/types/cohort";
import { useAuth } from "@/lib/auth-context";

export default function JoinCohortPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const accessCode = params.accessCode as string;

  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [cohort, setCohort] = useState<Cohort | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    if (accessCode) {
      fetchCohort();
    }
  }, [accessCode]);

  // If user is not logged in, save accessCode and redirect to login
  useEffect(() => {
    if (!authLoading && !user && cohort) {
      // Save the accessCode to localStorage so we can use it after login
      localStorage.setItem("pendingCohortJoin", accessCode);
      // Redirect to login with return URL
      router.push(`/login?returnTo=${encodeURIComponent(`/join/${accessCode}`)}`);
    }
  }, [authLoading, user, cohort, accessCode, router]);

  const fetchCohort = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/cohort/get?accessCode=${accessCode}`);

      if (!response.ok) {
        if (response.status === 404) {
          setError(
            "Cohort not found. Please check the access code and try again."
          );
        } else {
          setError("Failed to load cohort information.");
        }
        return;
      }

      const data = await response.json();

      if (!data.cohort) {
        setError(
          "Cohort not found. Please check the access code and try again."
        );
        return;
      }

      const cohortData = data.cohort as Cohort;

      // Check if cohort is active
      if (!cohortData.isActive) {
        setError("This cohort is no longer active.");
        return;
      }

      // Check if cohort is not yet available
      if (cohortData.availableDate) {
        const now = new Date();
        const availDate = new Date(cohortData.availableDate);
        if (now < availDate) {
          setError(
            `This cohort is not yet available. It will be available on ${availDate.toLocaleDateString()}.`
          );
          return;
        }
      }

      // Check if cohort has expired
      if (cohortData.expirationDate) {
        const now = new Date();
        const expDate = new Date(cohortData.expirationDate);
        if (now > expDate) {
          setError(
            "This cohort has expired and is no longer accepting new learners."
          );
          return;
        }
      }

      setCohort(cohortData);
    } catch (err) {
      console.error("Error fetching cohort:", err);
      setError("Failed to load cohort information. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!user?.email) {
      addToast({
        title: "Login required",
        description: "Please log in to join this cohort",
        color: "warning",
      });
      return;
    }

    if (!cohort) return;

    setJoining(true);

    try {
      const response = await fetch("/api/cohort/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessCode,
          email: user.email.trim().toLowerCase(),
          name: user.name || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to join cohort");
      }

      // Clear the pending join from localStorage
      localStorage.removeItem("pendingCohortJoin");

      setJoined(true);
      addToast({
        title: "Success!",
        description: "You have joined the cohort",
        color: "success",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to join cohort";
      addToast({ title: "Error", description: msg, color: "danger" });
    } finally {
      setJoining(false);
    }
  };

  // Show loading while checking auth
  if (authLoading) {
    return (
      <Card>
        <CardBody className="text-center py-12">
          <p className="text-default-500">Checking login status...</p>
        </CardBody>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardBody className="text-center py-12">
          <p className="text-default-500">Loading cohort information...</p>
        </CardBody>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardBody className="text-center py-12 space-y-4">
          <AlertCircle className="w-12 h-12 text-danger mx-auto" />
          <p className="text-danger">{error}</p>
          <Button variant="bordered" onPress={() => router.push("/")}>
            Go Home
          </Button>
        </CardBody>
      </Card>
    );
  }

  // If not logged in and cohort is valid, show login prompt
  if (!user && cohort) {
    return (
      <Card>
        <CardBody className="text-center py-12 space-y-4">
          <LogIn className="w-12 h-12 text-primary mx-auto" />
          <h2 className="text-xl font-bold">Login Required</h2>
          <p className="text-default-600">
            Please log in to join <strong>{cohort.name}</strong>
          </p>
          <Button 
            color="primary" 
            onPress={() => router.push(`/login?returnTo=${encodeURIComponent(`/join/${accessCode}`)}`)}
          >
            Log In to Continue
          </Button>
        </CardBody>
      </Card>
    );
  }

  if (joined) {
    return (
      <Card>
        <CardBody className="text-center py-12 space-y-4">
          <CheckCircle className="w-16 h-16 text-success mx-auto" />
          <h2 className="text-2xl font-bold">Welcome!</h2>
          <p className="text-default-600">
            You have successfully joined <strong>{cohort?.name}</strong>
          </p>
          <p className="text-sm text-default-500">
            You can now access the cases assigned to this cohort.
          </p>
          <Button color="primary" onPress={() => router.push("/student-cases")}>
            Go to My Cases
          </Button>
        </CardBody>
      </Card>
    );
  }

  if (!cohort) {
    return null;
  }

  const isUpcoming =
    cohort.availableDate && new Date() < new Date(cohort.availableDate);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex-col items-center text-center pb-0">
          <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mb-4">
            <Users className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">{cohort.name}</h1>
          {cohort.professorName && (
            <p className="text-default-500">by {cohort.professorName}</p>
          )}
        </CardHeader>
        <CardBody className="space-y-4">
          {cohort.description && (
            <p className="text-center text-default-600">{cohort.description}</p>
          )}

          <div className="flex flex-wrap justify-center gap-2">
            <Chip
              size="sm"
              variant="flat"
              color={isUpcoming ? "warning" : "success"}
            >
              {isUpcoming ? "Starts Soon" : "Active"}
            </Chip>
            <Chip size="sm" variant="bordered">
              {cohort.accessMode === "anyone" ? "Open Access" : "Restricted"}
            </Chip>
          </div>

          {(cohort.availableDate || cohort.expirationDate) && (
            <div className="flex items-center justify-center gap-2 text-sm text-default-500">
              <Calendar className="w-4 h-4" />
              <span>
                {cohort.availableDate
                  ? new Date(cohort.availableDate).toLocaleDateString()
                  : "Now"}{" "}
                -{" "}
                {cohort.expirationDate
                  ? new Date(cohort.expirationDate).toLocaleDateString()
                  : "No expiration"}
              </span>
            </div>
          )}

          {/* Join Section - Only show if logged in */}
          {user && (
            <div className="border-t pt-4 space-y-4">
              <h3 className="font-semibold text-center">Join this Cohort</h3>
              <div className="p-3 bg-primary-50 rounded-lg text-center">
                <p className="text-sm text-primary-700">
                  You are logged in as <strong>{user.email}</strong>
                </p>
                {user.name && (
                  <p className="text-xs text-primary-600">({user.name})</p>
                )}
              </div>
              <Button
                color="primary"
                fullWidth
                size="lg"
                isLoading={joining}
                onPress={handleJoin}
              >
                {joining ? "Joining..." : "Join This Cohort"}
              </Button>
            </div>
          )}
        </CardBody>
      </Card>

      <p className="text-center text-xs text-default-400">
        Access Code: <code className="font-mono">{accessCode}</code>
      </p>
    </div>
  );
}
