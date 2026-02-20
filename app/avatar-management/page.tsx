"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Input } from "@heroui/input";
import { Plus, RefreshCw, Pencil, Trash2 } from "lucide-react";
import { addToast } from "@heroui/toast";
import { title } from "@/components/primitives";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@heroui/modal";
import { listPersonas, deletePersona } from "@/lib/persona-storage";
import type { Persona } from "@/types";
import AvatarImage from "@/components/AvatarImage";

export default function PersonaManagementPage() {
  const router = useRouter();
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");

  const loadPersonas = async () => {
    try {
      setLoading(true);
      setError(null);
      const list = await listPersonas();
      setPersonas(list);
    } catch (err) {
      console.error("Failed to load personas:", err);
      setError(err instanceof Error ? err.message : "Failed to load personas");
      addToast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to load personas",
        color: "danger",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPersonas();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadPersonas();
    setRefreshing(false);
  };

  const handleCreate = () => router.push("/avatar-management/edit/new");
  const handleEdit = (id: string) => router.push(`/avatar-management/edit/${id}`);

  const handleDeleteClick = (p: Persona) => {
    setConfirmDeleteId(p.id);
    setDeleteConfirmName("");
    onOpen();
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDeleteId) return;
    if (deleteConfirmName !== personas.find((x) => x.id === confirmDeleteId)?.name) {
      addToast({
        title: "Invalid confirmation",
        description: "Type the persona name exactly to confirm.",
        color: "danger",
      });
      return;
    }
    setDeletingId(confirmDeleteId);
    try {
      await deletePersona(confirmDeleteId);
      addToast({ title: "Persona deleted", color: "success" });
      onOpenChange();
      setConfirmDeleteId(null);
      setDeleteConfirmName("");
      await loadPersonas();
    } catch (err) {
      addToast({
        title: "Delete failed",
        description: err instanceof Error ? err.message : "Failed to delete",
        color: "danger",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const personaToDelete = confirmDeleteId
    ? personas.find((p) => p.id === confirmDeleteId)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className={title()}>Persona Management</h1>
        <div className="flex gap-2">
          <Button
            variant="bordered"
            startContent={<RefreshCw className="w-4 h-4" />}
            onPress={handleRefresh}
            isLoading={refreshing}
          >
            Refresh
          </Button>
          <Button
            color="primary"
            variant="solid"
            startContent={<Plus className="w-4 h-4" />}
            onPress={handleCreate}
          >
            Create Persona
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
          <p className="text-default-500">Loading personas...</p>
        </div>
      )}

      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {personas.map((persona) => (
            <Card key={persona.id} className="border border-default-200">
              <CardHeader className="flex gap-3">
                <AvatarImage
                  name={persona.name}
                  portrait={persona.avatarImageUrl}
                  size={48}
                />
                <div className="flex flex-col flex-1 min-w-0">
                  <p className="font-semibold truncate">{persona.name}</p>
                  <p className="text-sm text-default-500 truncate">
                    {persona.professionalTitle}
                  </p>
                  <p className="text-xs text-default-400 font-mono truncate mt-1">
                    Voice: {persona.voiceId}
                  </p>
                </div>
              </CardHeader>
              <CardBody className="pt-0 flex flex-row gap-2 justify-end">
                <Button
                  size="sm"
                  variant="flat"
                  startContent={<Pencil className="w-4 h-4" />}
                  onPress={() => handleEdit(persona.id)}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  color="danger"
                  variant="flat"
                  startContent={<Trash2 className="w-4 h-4" />}
                  onPress={() => handleDeleteClick(persona)}
                >
                  Delete
                </Button>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {!loading && personas.length === 0 && !error && (
        <div className="text-center py-12">
          <p className="text-default-500 mb-4">No personas found</p>
          <Button
            color="primary"
            variant="bordered"
            startContent={<Plus className="w-4 h-4" />}
            onPress={handleCreate}
          >
            Create your first persona
          </Button>
        </div>
      )}

      <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
        <ModalContent>
          <ModalHeader>Delete Persona</ModalHeader>
          <ModalBody>
            {personaToDelete && (
              <>
                <p className="text-sm text-default-600">
                  Type <strong>{personaToDelete.name}</strong> to confirm deletion.
                </p>
                <Input
                  label="Confirm persona name"
                  placeholder="Type the name to confirm"
                  value={deleteConfirmName}
                  onValueChange={setDeleteConfirmName}
                  className="mt-2"
                />
              </>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={onOpenChange}>
              Cancel
            </Button>
            <Button
              color="danger"
              isDisabled={personaToDelete ? deleteConfirmName !== personaToDelete.name : true}
              isLoading={deletingId === confirmDeleteId}
              onPress={handleDeleteConfirm}
            >
              Delete
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
