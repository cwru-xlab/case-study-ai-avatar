"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/modal";
import {
  ArrowLeft,
  Search,
  UserPlus,
  Mail,
  Trash2,
  Download,
  RefreshCw,
  Users,
  CheckCircle,
  Clock,
  XCircle,
} from "lucide-react";
import { addToast } from "@heroui/toast";
import { title as pageTitle } from "@/components/primitives";
import { cohortStorage } from "@/lib/cohort-storage";
import type { CachedCohort, CohortStudent } from "@/types/cohort";

type StudentStatus = CohortStudent["status"];

const STATUS_CONFIG: Record<
  StudentStatus,
  { label: string; color: "success" | "warning" | "danger" | "default"; icon: React.ReactNode }
> = {
  joined: {
    label: "Joined",
    color: "success",
    icon: <CheckCircle className="w-3.5 h-3.5" />,
  },
  invited: {
    label: "Invited",
    color: "warning",
    icon: <Clock className="w-3.5 h-3.5" />,
  },
  active: {
    label: "Active",
    color: "success",
    icon: <CheckCircle className="w-3.5 h-3.5" />,
  },
  completed: {
    label: "Completed",
    color: "default",
    icon: <CheckCircle className="w-3.5 h-3.5" />,
  },
};

export default function CohortLearnersPage() {
  const params = useParams();
  const router = useRouter();
  const cohortId = params["cohort-id"] as string;

  const [cohort, setCohort] = useState<CachedCohort | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Add learner modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [addingLearner, setAddingLearner] = useState(false);

  // Remove learner modal
  const [showRemoveModal, setShowRemoveModal] = useState(false);
  const [learnerToRemove, setLearnerToRemove] = useState<CohortStudent | null>(null);
  const [removingLearner, setRemovingLearner] = useState(false);

  useEffect(() => {
    loadCohort();
  }, [cohortId]);

  const loadCohort = async () => {
    try {
      setLoading(true);
      const data = await cohortStorage.get(cohortId);
      if (data) {
        setCohort(data);
      } else {
        addToast({ title: "Cohort not found", color: "danger" });
        router.push("/cohort-management");
      }
    } catch (err) {
      console.error("Failed to load cohort:", err);
      addToast({ title: "Failed to load cohort", color: "danger" });
    } finally {
      setLoading(false);
    }
  };

  const filteredStudents = useMemo(() => {
    if (!cohort?.students) return [];
    if (!searchQuery.trim()) return cohort.students;

    const query = searchQuery.toLowerCase();
    return cohort.students.filter(
      (s) =>
        s.email.toLowerCase().includes(query) ||
        s.name?.toLowerCase().includes(query)
    );
  }, [cohort?.students, searchQuery]);

  const studentStats = useMemo(() => {
    if (!cohort?.students) return { total: 0, joined: 0, invited: 0, active: 0 };

    const students = cohort.students;
    return {
      total: students.length,
      joined: students.filter((s) => s.status === "joined").length,
      invited: students.filter((s) => s.status === "invited").length,
      active: students.filter((s) => s.status === "active").length,
    };
  }, [cohort?.students]);

  const handleAddLearner = async () => {
    if (!cohort || !newEmail.trim()) return;

    const email = newEmail.trim().toLowerCase();
    if (!email.includes("@")) {
      addToast({ title: "Invalid email address", color: "danger" });
      return;
    }

    if (cohort.students?.some((s) => s.email.toLowerCase() === email)) {
      addToast({ title: "Learner already exists", color: "warning" });
      return;
    }

    setAddingLearner(true);
    try {
      const newStudent: CohortStudent = {
        email,
        name: newName.trim() || undefined,
        status: "invited",
      };

      const updatedStudents = [...(cohort.students || []), newStudent];

      await cohortStorage.update(cohortId, { students: updatedStudents });

      setCohort((prev) =>
        prev ? { ...prev, students: updatedStudents } : prev
      );

      addToast({ title: "Learner added", color: "success" });
      setShowAddModal(false);
      setNewEmail("");
      setNewName("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to add learner";
      addToast({ title: msg, color: "danger" });
    } finally {
      setAddingLearner(false);
    }
  };

  const handleRemoveLearner = async () => {
    if (!cohort || !learnerToRemove) return;

    setRemovingLearner(true);
    try {
      const updatedStudents = cohort.students?.filter(
        (s) => s.email.toLowerCase() !== learnerToRemove.email.toLowerCase()
      ) || [];

      await cohortStorage.update(cohortId, { students: updatedStudents });

      setCohort((prev) =>
        prev ? { ...prev, students: updatedStudents } : prev
      );

      addToast({ title: "Learner removed", color: "success" });
      setShowRemoveModal(false);
      setLearnerToRemove(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to remove learner";
      addToast({ title: msg, color: "danger" });
    } finally {
      setRemovingLearner(false);
    }
  };

  const handleExportCSV = () => {
    if (!cohort?.students?.length) {
      addToast({ title: "No learners to export", color: "warning" });
      return;
    }

    const headers = ["Email", "Name", "Status", "Joined At"];
    const rows = cohort.students.map((s) => [
      s.email,
      s.name || "",
      s.status,
      s.joinedAt || "",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${cohort.name.replace(/\s+/g, "_")}_learners.csv`;
    link.click();
    URL.revokeObjectURL(url);

    addToast({ title: "CSV exported", color: "success" });
  };

  const handleBack = () => router.push("/cohort-management");

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="text-center py-12">
          <p className="text-default-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!cohort) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="text-center py-12">
          <p className="text-default-500">Cohort not found</p>
          <Button className="mt-4" onPress={handleBack}>
            Back to Cohorts
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button isIconOnly variant="light" onPress={handleBack}>
          <ArrowLeft />
        </Button>
        <div className="flex-1">
          <h1 className={pageTitle()}>{cohort.name}</h1>
          <p className="text-default-500 text-sm">Manage learners in this cohort</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardBody className="flex flex-row items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{studentStats.total}</p>
              <p className="text-xs text-default-500">Total Learners</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex flex-row items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10">
              <CheckCircle className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold">{studentStats.joined}</p>
              <p className="text-xs text-default-500">Joined</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex flex-row items-center gap-3">
            <div className="p-2 rounded-lg bg-warning/10">
              <Clock className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold">{studentStats.invited}</p>
              <p className="text-xs text-default-500">Invited</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex flex-row items-center gap-3">
            <div className="p-2 rounded-lg bg-secondary/10">
              <CheckCircle className="w-5 h-5 text-secondary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{studentStats.active}</p>
              <p className="text-xs text-default-500">Active</p>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <Input
          placeholder="Search by email or name..."
          value={searchQuery}
          onValueChange={setSearchQuery}
          startContent={<Search className="w-4 h-4 text-default-400" />}
          className="w-full sm:w-80"
          isClearable
          onClear={() => setSearchQuery("")}
        />
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="bordered"
            size="sm"
            startContent={<RefreshCw className="w-4 h-4" />}
            onPress={loadCohort}
          >
            Refresh
          </Button>
          <Button
            variant="bordered"
            size="sm"
            startContent={<Download className="w-4 h-4" />}
            onPress={handleExportCSV}
            isDisabled={!cohort.students?.length}
          >
            Export CSV
          </Button>
          <Button
            color="primary"
            size="sm"
            startContent={<UserPlus className="w-4 h-4" />}
            onPress={() => setShowAddModal(true)}
          >
            Add Learner
          </Button>
        </div>
      </div>

      {/* Learners Table */}
      <Card>
        <CardBody className="p-0">
          {filteredStudents.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-12 h-12 mx-auto text-default-300 mb-4" />
              {searchQuery ? (
                <>
                  <p className="text-default-500">No learners match your search</p>
                  <Button
                    variant="light"
                    size="sm"
                    className="mt-2"
                    onPress={() => setSearchQuery("")}
                  >
                    Clear search
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-default-500">No learners in this cohort yet</p>
                  <Button
                    color="primary"
                    variant="flat"
                    size="sm"
                    className="mt-4"
                    startContent={<UserPlus className="w-4 h-4" />}
                    onPress={() => setShowAddModal(true)}
                  >
                    Add your first learner
                  </Button>
                </>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-default-100">
                  <tr>
                    <th className="text-left p-4 font-medium">Email</th>
                    <th className="text-left p-4 font-medium">Name</th>
                    <th className="text-left p-4 font-medium">Status</th>
                    <th className="text-left p-4 font-medium">Joined</th>
                    <th className="text-left p-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-default-200">
                  {filteredStudents.map((student) => {
                    const statusConfig = STATUS_CONFIG[student.status];
                    return (
                      <tr key={student.email} className="hover:bg-default-50">
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-default-400" />
                            <span className="font-mono text-sm">{student.email}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          {student.name || (
                            <span className="text-default-400">—</span>
                          )}
                        </td>
                        <td className="p-4">
                          <Chip
                            size="sm"
                            color={statusConfig.color}
                            variant="flat"
                            startContent={statusConfig.icon}
                          >
                            {statusConfig.label}
                          </Chip>
                        </td>
                        <td className="p-4">
                          {student.joinedAt ? (
                            new Date(student.joinedAt).toLocaleDateString()
                          ) : (
                            <span className="text-default-400">—</span>
                          )}
                        </td>
                        <td className="p-4">
                          <Button
                            size="sm"
                            variant="light"
                            color="danger"
                            isIconOnly
                            onPress={() => {
                              setLearnerToRemove(student);
                              setShowRemoveModal(true);
                            }}
                            title="Remove learner"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Cohort Info */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Cohort Details</h3>
        </CardHeader>
        <CardBody className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-default-500">Access Mode</span>
            <Chip
              size="sm"
              variant="bordered"
              color={cohort.accessMode === "anyone" ? "success" : "warning"}
            >
              {cohort.accessMode === "anyone" ? "Open Access" : "Restricted"}
            </Chip>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-default-500">Access Code</span>
            <code className="font-mono text-primary font-bold">
              {cohort.accessCode}
            </code>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-default-500">Status</span>
            <Chip
              size="sm"
              variant="flat"
              color={cohort.isActive ? "success" : "default"}
            >
              {cohort.isActive ? "Active" : "Inactive"}
            </Chip>
          </div>
          {cohort.assignedCaseIds && cohort.assignedCaseIds.length > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-default-500">Assigned Cases</span>
              <span>{cohort.assignedCaseIds.length} case(s)</span>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Add Learner Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)}>
        <ModalContent>
          <ModalHeader>Add Learner</ModalHeader>
          <ModalBody className="space-y-4">
            <Input
              label="Email Address"
              placeholder="learner@example.com"
              value={newEmail}
              onValueChange={setNewEmail}
              type="email"
              isRequired
              startContent={<Mail className="w-4 h-4 text-default-400" />}
            />
            <Input
              label="Name (optional)"
              placeholder="John Doe"
              value={newName}
              onValueChange={setNewName}
            />
            <p className="text-xs text-default-400">
              The learner will be added with &quot;Invited&quot; status. They can join
              using the cohort access code.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="bordered" onPress={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button
              color="primary"
              isLoading={addingLearner}
              isDisabled={!newEmail.trim()}
              onPress={handleAddLearner}
            >
              {addingLearner ? "Adding..." : "Add Learner"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Remove Learner Modal */}
      <Modal isOpen={showRemoveModal} onClose={() => setShowRemoveModal(false)}>
        <ModalContent>
          <ModalHeader>Remove Learner</ModalHeader>
          <ModalBody>
            <p>
              Are you sure you want to remove{" "}
              <strong>{learnerToRemove?.email}</strong> from this cohort?
            </p>
            <p className="text-sm text-default-500 mt-2">
              They will lose access to all cases assigned to this cohort.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="bordered" onPress={() => setShowRemoveModal(false)}>
              Cancel
            </Button>
            <Button
              color="danger"
              isLoading={removingLearner}
              onPress={handleRemoveLearner}
            >
              {removingLearner ? "Removing..." : "Remove"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
