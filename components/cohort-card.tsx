"use client";

import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Button } from "@heroui/button";
import { Users, Copy, Pencil, Eye, Trash2 } from "lucide-react";
import { addToast } from "@heroui/toast";
import type { CachedCohort } from "@/types/cohort";
import { ACCESS_MODE_LABELS } from "@/types/cohort";

interface CohortCardProps {
  cohort: CachedCohort;
  onEdit: (cohortId: string) => void;
  onViewLearners: (cohortId: string) => void;
  onDelete: (cohortId: string) => void;
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleDateString();
}

function getCohortStatus(cohort: CachedCohort): {
  label: string;
  color: "success" | "warning" | "danger" | "default";
} {
  if (!cohort.isActive) {
    return { label: "Inactive", color: "default" };
  }

  const now = new Date();

  // Check if not yet available
  if (cohort.availableDate) {
    const availDate = new Date(cohort.availableDate);
    if (now < availDate) {
      return { label: "Upcoming", color: "warning" };
    }
  }

  // Check if expired
  if (cohort.expirationDate) {
    const expDate = new Date(cohort.expirationDate);
    if (now > expDate) {
      return { label: "Expired", color: "danger" };
    }
  }

  return { label: "Active", color: "success" };
}

export default function CohortCard({
  cohort,
  onEdit,
  onViewLearners,
  onDelete,
}: CohortCardProps) {
  const status = getCohortStatus(cohort);
  const learnerCount = cohort.students?.length || 0;

  const copyToClipboard = (text: string, successMessage: string) => {
    if (!text) return;

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(() => {
          addToast({
            title: "Copied",
            description: successMessage,
            color: "success",
          });
        })
        .catch(() => {
          fallbackCopy(text, successMessage);
        });
    } else {
      fallbackCopy(text, successMessage);
    }
  };

  const fallbackCopy = (text: string, successMessage: string) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      document.execCommand("copy");
      addToast({
        title: "Copied",
        description: successMessage,
        color: "success",
      });
    } catch {
      addToast({
        title: "Copy failed",
        description: "Could not copy to clipboard",
        color: "danger",
      });
    }

    document.body.removeChild(textArea);
  };

  const getJoinLink = () => {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/join/${cohort.accessCode}`;
    }
    return `/join/${cohort.accessCode}`;
  };

  const handleCopyLink = () => {
    copyToClipboard(getJoinLink(), "Join link copied to clipboard");
  };

  const handleCopyCode = () => {
    copyToClipboard(cohort.accessCode, "Access code copied to clipboard");
  };

  const handleEdit = () => {
    onEdit(cohort.id);
  };

  const handleViewLearners = () => {
    onViewLearners(cohort.id);
  };

  const handleDelete = () => {
    onDelete(cohort.id);
  };

  return (
    <Card className="h-full">
      <CardHeader className="flex gap-3">
        <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
          <Users className="w-6 h-6 text-primary" />
        </div>
        <div className="flex flex-col flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-md font-semibold">{cohort.name}</p>
            <Chip size="sm" color={status.color} variant="solid">
              {status.label}
            </Chip>
          </div>
          {cohort.description && (
            <p className="text-small text-default-500 line-clamp-1">
              {cohort.description}
            </p>
          )}
        </div>
      </CardHeader>
      <CardBody className="pt-0">
        <div className="space-y-3">
          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-default-400">Available:</span>{" "}
              <span className="font-medium">
                {cohort.availableDate ? formatDate(cohort.availableDate) : "Now"}
              </span>
            </div>
            <div>
              <span className="text-default-400">Expires:</span>{" "}
              <span className="font-medium">
                {cohort.expirationDate
                  ? formatDate(cohort.expirationDate)
                  : "Never"}
              </span>
            </div>
            <div>
              <span className="text-default-400">Access:</span>{" "}
              <span className="font-medium">
                {cohort.accessMode === "anyone" ? "Open" : "Restricted"}
              </span>
            </div>
            <div>
              <span className="text-default-400">Learners:</span>{" "}
              <span className="font-medium">{learnerCount}</span>
            </div>
          </div>

          {/* Access Code */}
          <div className="flex items-center justify-between p-2 bg-default-100 rounded-lg">
            <div>
              <span className="text-xs text-default-400">Code: </span>
              <code className="font-mono font-bold text-primary">
                {cohort.accessCode}
              </code>
            </div>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="light"
                isIconOnly
                onPress={handleCopyCode}
                title="Copy access code"
              >
                <Copy className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2 border-t border-default-200">
            <Button
              size="sm"
              variant="flat"
              startContent={<Pencil className="w-3.5 h-3.5" />}
              onPress={handleEdit}
              className="flex-1"
            >
              Edit
            </Button>
            <Button
              size="sm"
              variant="flat"
              startContent={<Eye className="w-3.5 h-3.5" />}
              onPress={handleViewLearners}
              className="flex-1"
            >
              Learners
            </Button>
            <Button
              size="sm"
              variant="light"
              isIconOnly
              color="danger"
              onPress={handleDelete}
              title="Delete cohort"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>

          {/* Copy Link Button */}
          <Button
            size="sm"
            variant="bordered"
            fullWidth
            startContent={<Copy className="w-3.5 h-3.5" />}
            onPress={handleCopyLink}
          >
            Copy Join Link
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
