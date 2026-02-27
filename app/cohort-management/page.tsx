"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/modal";
import {
  Plus,
  RefreshCw,
  LayoutGrid,
  List,
  Copy,
  Pencil,
  Eye,
  Trash2,
} from "lucide-react";
import { addToast } from "@heroui/toast";
import { title } from "@/components/primitives";
import CohortCard from "@/components/cohort-card";
import { cohortStorage } from "@/lib/cohort-storage";
import type { CachedCohort } from "@/types/cohort";

type ViewMode = "cards" | "table";

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

  if (cohort.availableDate) {
    const availDate = new Date(cohort.availableDate);
    if (now < availDate) {
      return { label: "Upcoming", color: "warning" };
    }
  }

  if (cohort.expirationDate) {
    const expDate = new Date(cohort.expirationDate);
    if (now > expDate) {
      return { label: "Expired", color: "danger" };
    }
  }

  return { label: "Active", color: "success" };
}

export default function CohortManagementPage() {
  const router = useRouter();
  const [cohorts, setCohorts] = useState<CachedCohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("cards");

  // Delete confirmation modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [cohortToDelete, setCohortToDelete] = useState<CachedCohort | null>(
    null
  );
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadCohorts();
  }, []);

  const loadCohorts = async () => {
    try {
      setLoading(true);
      setError(null);
      const cohortList = await cohortStorage.list();
      setCohorts(cohortList);
    } catch (err) {
      console.error("Failed to load cohorts:", err);
      setError("Failed to load cohorts");
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      const cohortList = await cohortStorage.list();
      setCohorts(cohortList);
    } catch (err) {
      console.error("Failed to sync cohorts:", err);
      setError("Failed to sync cohorts");
    } finally {
      setSyncing(false);
    }
  };

  const handleEdit = (cohortId: string) => {
    router.push(`/cohort-management/edit/${cohortId}`);
  };

  const handleViewLearners = (cohortId: string) => {
    addToast({
      title: "Coming Soon",
      description: "Learner view will be available soon",
      color: "warning",
    });
  };

  const handleDeleteClick = (cohortId: string) => {
    const cohort = cohorts.find((c) => c.id === cohortId);
    if (cohort) {
      setCohortToDelete(cohort);
      setDeleteModalOpen(true);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!cohortToDelete) return;

    setDeleting(true);
    try {
      await cohortStorage.delete(cohortToDelete.id);
      setCohorts((prev) => prev.filter((c) => c.id !== cohortToDelete.id));
      addToast({ title: "Cohort deleted", color: "success" });
      setDeleteModalOpen(false);
      setCohortToDelete(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete";
      addToast({ title: "Delete failed", description: msg, color: "danger" });
    } finally {
      setDeleting(false);
    }
  };

  const handleAddCohort = () => {
    router.push("/cohort-management/edit/new");
  };

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

  const getJoinLink = (accessCode: string) => {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/join/${accessCode}`;
    }
    return `/join/${accessCode}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className={title()}>Cohort Management</h1>
        <div className="flex gap-2 flex-wrap">
          {/* View Toggle */}
          <div className="flex border rounded-lg overflow-hidden">
            <Button
              size="sm"
              variant={viewMode === "cards" ? "solid" : "light"}
              isIconOnly
              onPress={() => setViewMode("cards")}
              className="rounded-none"
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant={viewMode === "table" ? "solid" : "light"}
              isIconOnly
              onPress={() => setViewMode("table")}
              className="rounded-none"
            >
              <List className="w-4 h-4" />
            </Button>
          </div>

          <Button
            variant="bordered"
            startContent={<RefreshCw className="w-4 h-4" />}
            onPress={handleSync}
            isLoading={syncing}
            size="sm"
          >
            {syncing ? "Syncing..." : "Sync"}
          </Button>
          <Button
            color="primary"
            variant="solid"
            startContent={<Plus className="w-4 h-4" />}
            onPress={handleAddCohort}
            size="sm"
          >
            Add Cohort
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-danger-50 border border-danger-200 rounded-lg text-danger-700">
          {error}
        </div>
      )}

      {loading && (
        <div className="text-center py-12">
          <p className="text-default-500">Loading cohorts...</p>
        </div>
      )}

      {!loading && viewMode === "cards" && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {cohorts.map((cohort) => (
            <CohortCard
              key={cohort.id}
              cohort={cohort}
              onEdit={handleEdit}
              onViewLearners={handleViewLearners}
              onDelete={handleDeleteClick}
            />
          ))}
        </div>
      )}

      {!loading && viewMode === "table" && cohorts.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-default-200">
          <table className="w-full text-sm">
            <thead className="bg-default-100">
              <tr>
                <th className="text-left p-3 font-medium">Cohort Name</th>
                <th className="text-left p-3 font-medium">Status</th>
                <th className="text-left p-3 font-medium">Available</th>
                <th className="text-left p-3 font-medium">Expires</th>
                <th className="text-left p-3 font-medium">Access</th>
                <th className="text-left p-3 font-medium">Learners</th>
                <th className="text-left p-3 font-medium">Code</th>
                <th className="text-left p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-default-200">
              {cohorts.map((cohort) => {
                const status = getCohortStatus(cohort);
                return (
                  <tr key={cohort.id} className="hover:bg-default-50">
                    <td className="p-3">
                      <div>
                        <p className="font-medium">{cohort.name}</p>
                        {cohort.description && (
                          <p className="text-xs text-default-400 line-clamp-1">
                            {cohort.description}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      <Chip size="sm" color={status.color} variant="flat">
                        {status.label}
                      </Chip>
                    </td>
                    <td className="p-3">
                      {cohort.availableDate
                        ? formatDate(cohort.availableDate)
                        : "Now"}
                    </td>
                    <td className="p-3">
                      {cohort.expirationDate
                        ? formatDate(cohort.expirationDate)
                        : "Never"}
                    </td>
                    <td className="p-3">
                      <Chip
                        size="sm"
                        variant="bordered"
                        color={
                          cohort.accessMode === "anyone" ? "success" : "warning"
                        }
                      >
                        {cohort.accessMode === "anyone" ? "Open" : "Restricted"}
                      </Chip>
                    </td>
                    <td className="p-3">{cohort.students?.length || 0}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        <code className="font-mono text-sm">
                          {cohort.accessCode}
                        </code>
                        <Button
                          size="sm"
                          variant="light"
                          isIconOnly
                          onPress={() =>
                            copyToClipboard(
                              getJoinLink(cohort.accessCode),
                              "Join link copied"
                            )
                          }
                          title="Copy join link"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="light"
                          isIconOnly
                          onPress={() => handleEdit(cohort.id)}
                          title="Edit cohort"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="light"
                          isIconOnly
                          onPress={() => handleViewLearners(cohort.id)}
                          title="View learners"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="light"
                          isIconOnly
                          color="danger"
                          onPress={() => handleDeleteClick(cohort.id)}
                          title="Delete cohort"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && cohorts.length === 0 && (
        <div className="text-center py-12">
          <p className="text-default-500 mb-4">No cohorts found</p>
          <Button
            color="primary"
            variant="bordered"
            startContent={<Plus className="w-4 h-4" />}
            onPress={handleAddCohort}
          >
            Create your first cohort
          </Button>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal isOpen={deleteModalOpen} onClose={() => setDeleteModalOpen(false)}>
        <ModalContent>
          <ModalHeader>Delete Cohort</ModalHeader>
          <ModalBody>
            <p>
              Are you sure you want to delete{" "}
              <strong>{cohortToDelete?.name}</strong>?
            </p>
            <p className="text-sm text-default-500 mt-2">
              This action cannot be undone. All learner data associated with
              this cohort will be permanently removed.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="bordered"
              onPress={() => setDeleteModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              color="danger"
              isLoading={deleting}
              onPress={handleDeleteConfirm}
            >
              {deleting ? "Deleting..." : "Delete"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
