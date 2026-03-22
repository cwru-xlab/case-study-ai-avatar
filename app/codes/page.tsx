"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Input } from "@heroui/input";
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
  Share2,
  Link,
  Check,
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

function getCodeStatus(cohort: CachedCohort): {
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

export default function CodesPage() {
  const router = useRouter();
  const [codes, setCodes] = useState<CachedCohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("cards");

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [codeToDelete, setCodeToDelete] = useState<CachedCohort | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [codeToShare, setCodeToShare] = useState<CachedCohort | null>(null);
  const [copiedField, setCopiedField] = useState<"code" | "link" | null>(null);

  useEffect(() => {
    loadCodes();
  }, []);

  const loadCodes = async () => {
    try {
      setLoading(true);
      setError(null);
      const codeList = await cohortStorage.list();
      setCodes(codeList);
    } catch (err) {
      console.error("Failed to load codes:", err);
      setError("Failed to load cohorts");
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      const codeList = await cohortStorage.list();
      setCodes(codeList);
    } catch (err) {
      console.error("Failed to sync codes:", err);
      setError("Failed to sync cohorts");
    } finally {
      setSyncing(false);
    }
  };

  const handleEdit = (codeId: string) => {
    router.push(`/codes/${codeId}/edit`);
  };

  const handleViewLearners = (codeId: string) => {
    router.push(`/codes/${codeId}`);
  };

  const handleDeleteClick = (codeId: string) => {
    const code = codes.find((c) => c.id === codeId);
    if (code) {
      setCodeToDelete(code);
      setDeleteModalOpen(true);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!codeToDelete) return;

    setDeleting(true);
    try {
      await cohortStorage.delete(codeToDelete.id);
      setCodes((prev) => prev.filter((c) => c.id !== codeToDelete.id));
      addToast({ title: "Cohort deleted", color: "success" });
      setDeleteModalOpen(false);
      setCodeToDelete(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to delete";
      addToast({ title: "Delete failed", description: msg, color: "danger" });
    } finally {
      setDeleting(false);
    }
  };

  const handleAddCode = () => {
    router.push("/codes/new/edit");
  };

  const handleUpdate = async (cohortId: string, updates: Partial<CachedCohort>) => {
    const cohort = codes.find((c) => c.id === cohortId);
    if (!cohort) return;

    const updatedCohort = { ...cohort, ...updates };
    await cohortStorage.save(updatedCohort);
    setCodes((prev) => prev.map((c) => (c.id === cohortId ? updatedCohort : c)));
  };

  const handleShareClick = (codeId: string) => {
    const code = codes.find((c) => c.id === codeId);
    if (code) {
      setCodeToShare(code);
      setShareModalOpen(true);
      setCopiedField(null);
    }
  };

  const copyToClipboard = (text: string, field: "code" | "link") => {
    if (!text) return;

    const successMessage = field === "code" ? "Access code copied" : "Join link copied";

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(() => {
          setCopiedField(field);
          addToast({
            title: "Copied",
            description: successMessage,
            color: "success",
          });
          setTimeout(() => setCopiedField(null), 2000);
        })
        .catch(() => {
          fallbackCopy(text, field);
        });
    } else {
      fallbackCopy(text, field);
    }
  };

  const fallbackCopy = (text: string, field: "code" | "link") => {
    const successMessage = field === "code" ? "Access code copied" : "Join link copied";
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
      setCopiedField(field);
      addToast({
        title: "Copied",
        description: successMessage,
        color: "success",
      });
      setTimeout(() => setCopiedField(null), 2000);
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
            onPress={handleAddCode}
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
          {codes.map((code) => (
            <CohortCard
              key={code.id}
              cohort={code}
              onEdit={handleEdit}
              onViewLearners={handleViewLearners}
              onDelete={handleDeleteClick}
              onShare={handleShareClick}
              onUpdate={handleUpdate}
            />
          ))}
        </div>
      )}

      {!loading && viewMode === "table" && codes.length > 0 && (
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
                <th className="text-left p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-default-200">
              {codes.map((code) => {
                const status = getCodeStatus(code);
                return (
                  <tr key={code.id} className="hover:bg-default-50">
                    <td className="p-3">
                      <div>
                        <p className="font-medium">{code.name}</p>
                        {code.description && (
                          <p className="text-xs text-default-400 line-clamp-1">
                            {code.description}
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
                      {code.availableDate
                        ? formatDate(code.availableDate)
                        : "Now"}
                    </td>
                    <td className="p-3">
                      {code.expirationDate
                        ? formatDate(code.expirationDate)
                        : "Never"}
                    </td>
                    <td className="p-3">
                      <Chip
                        size="sm"
                        variant="bordered"
                        color={
                          code.accessMode === "anyone" ? "success" : "warning"
                        }
                      >
                        {code.accessMode === "anyone" ? "Open" : "Restricted"}
                      </Chip>
                    </td>
                    <td className="p-3">{code.students?.length || 0}</td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="flat"
                          color="primary"
                          startContent={<Share2 className="w-3.5 h-3.5" />}
                          onPress={() => handleShareClick(code.id)}
                          title="Invite students"
                        >
                          Invite
                        </Button>
                        <Button
                          size="sm"
                          variant="light"
                          isIconOnly
                          onPress={() => handleEdit(code.id)}
                          title="Edit cohort"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="light"
                          isIconOnly
                          onPress={() => handleViewLearners(code.id)}
                          title="View learners"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="light"
                          isIconOnly
                          color="danger"
                          onPress={() => handleDeleteClick(code.id)}
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

      {!loading && codes.length === 0 && (
        <div className="text-center py-12">
          <p className="text-default-500 mb-4">No cohorts found</p>
          <Button
            color="primary"
            variant="bordered"
            startContent={<Plus className="w-4 h-4" />}
            onPress={handleAddCode}
          >
            Create your first cohort
          </Button>
        </div>
      )}

      <Modal isOpen={deleteModalOpen} onClose={() => setDeleteModalOpen(false)}>
        <ModalContent>
          <ModalHeader>Delete Cohort</ModalHeader>
          <ModalBody>
            <p>
              Are you sure you want to delete{" "}
              <strong>{codeToDelete?.name}</strong>?
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

      {/* Share/Invite Modal */}
      <Modal 
        isOpen={shareModalOpen} 
        onClose={() => {
          setShareModalOpen(false);
          setCopiedField(null);
        }}
        size="lg"
      >
        <ModalContent>
          <ModalHeader className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-primary" />
            Invite Students to {codeToShare?.name}
          </ModalHeader>
          <ModalBody className="space-y-4">
            <p className="text-default-500 text-sm">
              Share the access code or join link with your students so they can enroll in this cohort.
            </p>
            
            {/* Access Code */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Access Code</label>
              <div className="flex gap-2">
                <Input
                  value={codeToShare?.accessCode || ""}
                  readOnly
                  classNames={{
                    input: "font-mono font-bold text-lg",
                  }}
                />
                <Button
                  color={copiedField === "code" ? "success" : "primary"}
                  variant="flat"
                  startContent={copiedField === "code" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  onPress={() => copyToClipboard(codeToShare?.accessCode || "", "code")}
                >
                  {copiedField === "code" ? "Copied!" : "Copy"}
                </Button>
              </div>
            </div>

            {/* Join Link */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Join Link</label>
              <div className="flex gap-2">
                <Input
                  value={codeToShare ? getJoinLink(codeToShare.accessCode) : ""}
                  readOnly
                  startContent={<Link className="w-4 h-4 text-default-400" />}
                  classNames={{
                    input: "text-sm",
                  }}
                />
                <Button
                  color={copiedField === "link" ? "success" : "primary"}
                  variant="flat"
                  startContent={copiedField === "link" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  onPress={() => copyToClipboard(codeToShare ? getJoinLink(codeToShare.accessCode) : "", "link")}
                >
                  {copiedField === "link" ? "Copied!" : "Copy"}
                </Button>
              </div>
              <p className="text-xs text-default-400">
                Students can visit this link directly to join the cohort.
              </p>
            </div>

            {/* Access Mode Info */}
            <div className="p-3 bg-default-100 rounded-lg">
              <div className="flex items-center gap-2">
                <Chip
                  size="sm"
                  variant="flat"
                  color={codeToShare?.accessMode === "anyone" ? "success" : "warning"}
                >
                  {codeToShare?.accessMode === "anyone" ? "Open Access" : "Restricted Access"}
                </Chip>
              </div>
              <p className="text-xs text-default-500 mt-2">
                {codeToShare?.accessMode === "anyone"
                  ? "Anyone with the access code can join this cohort."
                  : "Only pre-approved email addresses can join this cohort."}
              </p>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="bordered"
              onPress={() => {
                setShareModalOpen(false);
                setCopiedField(null);
              }}
            >
              Close
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
