"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import {
  ArrowLeft,
  Building2,
  MessageCircle,
  User,
  Briefcase,
} from "lucide-react";
import { title as pageTitle } from "@/components/primitives";
import { caseStorage } from "@/lib/case-storage";
import type { CaseStudy } from "@/types";

export default function StudentCaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const caseId = params.caseId as string;

  const [caseStudy, setCaseStudy] = useState<CaseStudy | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadCase = async () => {
      try {
        setIsLoading(true);
        const data = await caseStorage.get(caseId);
        if (data) {
          setCaseStudy(data);
        } else {
          setError("Case not found");
        }
      } catch (err) {
        console.error("Failed to load case:", err);
        setError("Failed to load case");
      } finally {
        setIsLoading(false);
      }
    };
    loadCase();
  }, [caseId]);

  const handleBack = () => {
    router.push("/student-cases");
  };

  const handleTalkTo = (avatarId: string) => {
    router.push(`/student-cases/${caseId}/talk/${avatarId}`);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 max-w-6xl mx-auto">
        <div className="text-center py-12">
          <p className="text-default-500">Loading case...</p>
        </div>
      </div>
    );
  }

  if (error || !caseStudy) {
    return (
      <div className="flex flex-col gap-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-4">
          <Button isIconOnly variant="light" onPress={handleBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className={pageTitle()}>Case Not Found</h1>
        </div>
        <Card>
          <CardBody className="text-center py-8">
            <p className="text-default-500">
              The requested case could not be found.
            </p>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-4">
        <Button isIconOnly variant="light" onPress={handleBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
            <Building2 className="text-primary" size={20} />
          </div>
          <div>
            <h1 className={pageTitle()}>{caseStudy.name}</h1>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold">Company Background</h2>
          </div>
        </CardHeader>
        <CardBody>
          <div className="prose prose-sm max-w-none dark:prose-invert">
            {caseStudy.backgroundInfo.split("\n").map((paragraph, i) => (
              <p key={i} className="text-default-700 mb-3 leading-relaxed">
                {paragraph}
              </p>
            ))}
          </div>
        </CardBody>
      </Card>

      <div>
        <div className="flex items-center gap-2 mb-4">
          <User className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-semibold">
            Executives ({caseStudy.avatars.length})
          </h2>
        </div>
        <p className="text-sm text-default-500 mb-4">
          Click on an executive to start a conversation and gather information
          for your case analysis.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {caseStudy.avatars.map((avatar) => (
            <Card
              key={avatar.id}
              className="hover:shadow-lg transition-shadow"
            >
              <CardBody className="p-5">
                <div className="flex items-start gap-4">
                  <div className="flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-primary-100 to-secondary-100 shrink-0">
                    <span className="text-xl font-bold text-primary-700">
                      {avatar.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold">{avatar.name}</h3>
                    <Chip size="sm" variant="flat" color="primary" className="mb-2">
                      {avatar.role}
                    </Chip>
                    <p className="text-sm text-default-600 line-clamp-3">
                      {avatar.additionalInfo.substring(0, 200)}
                      {avatar.additionalInfo.length > 200 ? "..." : ""}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  <Button
                    color="primary"
                    size="sm"
                    startContent={<MessageCircle className="w-4 h-4" />}
                    onPress={() => handleTalkTo(avatar.id)}
                    isDisabled={!avatar.avatarProfileId}
                  >
                    {avatar.avatarProfileId ? "Talk to this Executive" : "No Avatar Profile"}
                  </Button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
