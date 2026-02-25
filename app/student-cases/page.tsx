"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Briefcase, Users, Building2, RefreshCw } from "lucide-react";

import { title } from "@/components/primitives";
import { useAuth } from "@/lib/auth-context";
import { caseStorage } from "@/lib/case-storage";
import type { CaseStudy } from "@/types";

export default function StudentCasesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [cases, setCases] = useState<CaseStudy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCases();
  }, []);

  const loadCases = async () => {
    try {
      setLoading(true);
      setError(null);
      const caseList = await caseStorage.list();
      setCases(caseList);
    } catch (err) {
      console.error("Failed to load cases:", err);
      setError("Failed to load cases. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCaseClick = (caseId: string) => {
    router.push(`/student-cases/${caseId}`);
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className={title()}>
            {user?.name ? `${user.name}'s Cases` : "My Cases"}
          </h1>
          <p className="text-default-500">
            Select a case study to explore and interact with AI executives.
          </p>
        </div>
        <Button
          variant="bordered"
          startContent={<RefreshCw className="w-4 h-4" />}
          onPress={loadCases}
          isLoading={loading}
        >
          {loading ? "Loading..." : "Refresh"}
        </Button>
      </div>

      {error && (
        <div className="p-4 bg-danger-50 border border-danger-200 rounded-lg text-danger-700">
          {error}
        </div>
      )}

      {loading && (
        <div className="text-center py-12">
          <p className="text-default-500">Loading cases...</p>
        </div>
      )}

      {!loading && cases.length === 0 && !error && (
        <Card className="bg-default-50">
          <CardBody className="py-12 text-center">
            <Briefcase className="mx-auto mb-4 text-default-300" size={48} />
            <p className="text-default-500">
              No cases available yet. Check back soon.
            </p>
          </CardBody>
        </Card>
      )}

      {!loading && cases.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {cases.map((caseItem) => (
            <Card
              key={caseItem.id}
              isPressable
              className="hover:shadow-lg transition-shadow"
              onPress={() => handleCaseClick(caseItem.id)}
            >
              <CardHeader className="flex gap-3 pb-0">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
                  <Building2 className="text-primary" size={20} />
                </div>
                <div className="flex flex-col flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">
                    {caseItem.name}
                  </p>
                  <p className="text-xs text-default-500">
                    {caseItem.avatars.length} executive{caseItem.avatars.length !== 1 ? "s" : ""} to interview
                  </p>
                </div>
              </CardHeader>
              <CardBody className="pt-3">
                <p className="text-sm text-default-600 line-clamp-3 mb-4">
                  {caseItem.backgroundInfo.substring(0, 200)}...
                </p>
                <div className="flex items-center gap-2 text-xs text-default-400">
                  <Users size={14} />
                  <div className="flex flex-wrap gap-1">
                    {caseItem.avatars.slice(0, 3).map((avatar) => (
                      <span key={avatar.id} className="bg-default-100 px-2 py-0.5 rounded-full">
                        {avatar.name} — {avatar.role.split("(")[0].trim()}
                      </span>
                    ))}
                    {caseItem.avatars.length > 3 && (
                      <span className="bg-default-100 px-2 py-0.5 rounded-full">
                        +{caseItem.avatars.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
