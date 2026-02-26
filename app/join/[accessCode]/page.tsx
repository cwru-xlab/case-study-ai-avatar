"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Users, Calendar, CheckCircle, AlertCircle } from "lucide-react";
import { addToast } from "@heroui/toast";
import type { Cohort } from "@/types/cohort";
import { COHORT_MODE_LABELS } from "@/types/cohort";

export default function JoinCohortPage() {
  const params = useParams();
  const router = useRouter();
  const accessCode = params.accessCode as string;

  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [cohort, setCohort] = useState<Cohort | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    if (accessCode) {
      fetchCohort();
    }
  }, [accessCode]);

  const fetchCohort = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/cohort/get?accessCode=${accessCode}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          setError("Cohort not found. Please check the access code and try again.");
        } else {
          setError("Failed to load cohort information.");
        }
        return;
      }

      const data = await response.json();
      
      if (!data.cohort) {
        setError("Cohort not found. Please check the access code and try again.");
        return;
      }

      const cohortData = data.cohort as Cohort;

      // Check if cohort is active
      if (!cohortData.isActive) {
        setError("This cohort is no longer active.");
        return;
      }

      // Check if cohort has ended
      const now = new Date();
      const endDate = new Date(cohortData.endDate);
      if (now > endDate) {
        setError("This cohort has ended and is no longer accepting new students.");
        return;
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
    if (!email.trim()) {
      addToast({ title: "Email required", description: "Please enter your email address", color: "danger" });
      return;
    }

    if (!email.includes("@")) {
      addToast({ title: "Invalid email", description: "Please enter a valid email address", color: "danger" });
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
          email: email.trim().toLowerCase(),
          name: name.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to join cohort");
      }

      setJoined(true);
      addToast({ title: "Success!", description: "You have joined the cohort", color: "success" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to join cohort";
      addToast({ title: "Error", description: msg, color: "danger" });
    } finally {
      setJoining(false);
    }
  };

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
            Check your email for further instructions.
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

  const startDate = new Date(cohort.startDate);
  const endDate = new Date(cohort.endDate);
  const now = new Date();
  const isUpcoming = now < startDate;

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
            <Chip size="sm" variant="flat" color={isUpcoming ? "warning" : "success"}>
              {isUpcoming ? "Starts Soon" : "Active"}
            </Chip>
            <Chip size="sm" variant="bordered">
              {COHORT_MODE_LABELS[cohort.cohortMode]}
            </Chip>
            {cohort.caseName && (
              <Chip size="sm" variant="flat" color="secondary">
                {cohort.caseName}
              </Chip>
            )}
          </div>

          <div className="flex items-center justify-center gap-2 text-sm text-default-500">
            <Calendar className="w-4 h-4" />
            <span>
              {startDate.toLocaleDateString()} - {endDate.toLocaleDateString()}
            </span>
          </div>

          <div className="border-t pt-4 space-y-4">
            <h3 className="font-semibold text-center">Join this Cohort</h3>
            <Input
              type="email"
              label="Email Address"
              placeholder="your.email@example.com"
              value={email}
              onValueChange={setEmail}
              isRequired
            />
            <Input
              label="Your Name (optional)"
              placeholder="John Doe"
              value={name}
              onValueChange={setName}
            />
            <Button
              color="primary"
              fullWidth
              isLoading={joining}
              onPress={handleJoin}
            >
              {joining ? "Joining..." : "Join Cohort"}
            </Button>
          </div>
        </CardBody>
      </Card>

      <p className="text-center text-xs text-default-400">
        Access Code: <code className="font-mono">{accessCode}</code>
      </p>
    </div>
  );
}
