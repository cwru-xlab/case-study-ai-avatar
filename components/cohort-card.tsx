"use client";

import { useState } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { 
  Modal, 
  ModalContent, 
  ModalHeader, 
  ModalBody, 
  ModalFooter 
} from "@heroui/modal";
import { Select, SelectItem } from "@heroui/select";
import { Users, Trash2, Share2, Calendar, Clock, Lock, Unlock, ChevronRight } from "lucide-react";
import { addToast } from "@heroui/toast";
import type { CachedCohort } from "@/types/cohort";

interface CohortCardProps {
  cohort: CachedCohort;
  onEdit: (cohortId: string) => void;
  onViewLearners: (cohortId: string) => void;
  onDelete: (cohortId: string) => void;
  onShare: (cohortId: string) => void;
  onUpdate?: (cohortId: string, updates: Partial<CachedCohort>) => Promise<void>;
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "—";
  return new Date(dateString).toLocaleDateString();
}

function formatDateForInput(dateString: string | null): string {
  if (!dateString) return "";
  return new Date(dateString).toISOString().split("T")[0];
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

type EditField = "available" | "expires" | "access" | null;

export default function CohortCard({
  cohort,
  onEdit,
  onViewLearners,
  onDelete,
  onShare,
  onUpdate,
}: CohortCardProps) {
  const status = getCohortStatus(cohort);
  const learnerCount = cohort.students?.length || 0;

  const [editField, setEditField] = useState<EditField>(null);
  const [saving, setSaving] = useState(false);
  const [availableDate, setAvailableDate] = useState(formatDateForInput(cohort.availableDate));
  const [expirationDate, setExpirationDate] = useState(formatDateForInput(cohort.expirationDate));
  const [accessMode, setAccessMode] = useState(cohort.accessMode);

  const handleSave = async () => {
    if (!onUpdate) {
      setEditField(null);
      return;
    }

    setSaving(true);
    try {
      const updates: Partial<CachedCohort> = {};
      
      if (editField === "available") {
        updates.availableDate = availableDate ? new Date(availableDate).toISOString() : null;
      } else if (editField === "expires") {
        updates.expirationDate = expirationDate ? new Date(expirationDate).toISOString() : null;
      } else if (editField === "access") {
        updates.accessMode = accessMode;
      }

      await onUpdate(cohort.id, updates);
      addToast({ title: "Updated successfully", color: "success" });
      setEditField(null);
    } catch (err) {
      addToast({ title: "Failed to update", color: "danger" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Card className="h-full hover:shadow-md transition-shadow">
        {/* Header */}
        <CardHeader className="flex gap-3 pb-2">
          <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-md font-semibold truncate">{cohort.name}</p>
              <Chip size="sm" color={status.color} variant="flat">
                {status.label}
              </Chip>
            </div>
            {cohort.description && (
              <p className="text-xs text-default-500 line-clamp-1">
                {cohort.description}
              </p>
            )}
          </div>
        </CardHeader>

        <CardBody className="pt-0">
          <div className="space-y-3">
            {/* LEARNERS - Elegant clickable area */}
            <div
              className="relative overflow-hidden rounded-xl cursor-pointer transition-all group"
              onClick={() => onViewLearners(cohort.id)}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-indigo-600 opacity-90 group-hover:opacity-100 transition-opacity" />
              <div className="relative p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-white/20 backdrop-blur rounded-lg flex items-center justify-center">
                    <Users className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-bold text-white">{learnerCount}</span>
                      <span className="text-sm font-medium text-white/80">learners</span>
                    </div>
                    <p className="text-xs text-white/60">Click to manage</p>
                  </div>
                </div>
                <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center group-hover:bg-white/20 transition-colors">
                  <ChevronRight className="w-5 h-5 text-white group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </div>

            {/* Clickable Settings */}
            <div className="space-y-1">
              <div 
                className="flex items-center justify-between p-2 rounded-lg hover:bg-default-100 cursor-pointer transition-colors"
                onClick={() => {
                  setAvailableDate(formatDateForInput(cohort.availableDate));
                  setEditField("available");
                }}
              >
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-default-400" />
                  <span className="text-default-500">Available</span>
                </div>
                <span className="text-sm font-medium text-primary hover:underline">
                  {cohort.availableDate ? formatDate(cohort.availableDate) : "Now"}
                </span>
              </div>

              <div 
                className="flex items-center justify-between p-2 rounded-lg hover:bg-default-100 cursor-pointer transition-colors"
                onClick={() => {
                  setExpirationDate(formatDateForInput(cohort.expirationDate));
                  setEditField("expires");
                }}
              >
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-default-400" />
                  <span className="text-default-500">Expires</span>
                </div>
                <span className="text-sm font-medium text-primary hover:underline">
                  {cohort.expirationDate ? formatDate(cohort.expirationDate) : "Never"}
                </span>
              </div>

              <div 
                className="flex items-center justify-between p-2 rounded-lg hover:bg-default-100 cursor-pointer transition-colors"
                onClick={() => {
                  setAccessMode(cohort.accessMode);
                  setEditField("access");
                }}
              >
                <div className="flex items-center gap-2 text-sm">
                  {cohort.accessMode === "anyone" ? (
                    <Unlock className="w-4 h-4 text-default-400" />
                  ) : (
                    <Lock className="w-4 h-4 text-default-400" />
                  )}
                  <span className="text-default-500">Access</span>
                </div>
                <Chip size="sm" variant="flat" color={cohort.accessMode === "anyone" ? "success" : "warning"} className="cursor-pointer">
                  {cohort.accessMode === "anyone" ? "Open" : "Restricted"}
                </Chip>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2 border-t border-default-200">
              <Button
                size="sm"
                color="primary"
                variant="flat"
                startContent={<Share2 className="w-3.5 h-3.5" />}
                onPress={() => onShare(cohort.id)}
                className="flex-1"
              >
                Invite
              </Button>
              <Button
                size="sm"
                variant="bordered"
                onPress={() => onEdit(cohort.id)}
                className="flex-1"
              >
                Edit All
              </Button>
              <Button
                size="sm"
                variant="light"
                isIconOnly
                color="danger"
                onPress={() => onDelete(cohort.id)}
                title="Delete cohort"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Edit Available Date Modal */}
      <Modal isOpen={editField === "available"} onClose={() => setEditField(null)} size="sm">
        <ModalContent>
          <ModalHeader>Edit Available Date</ModalHeader>
          <ModalBody>
            <Input
              type="date"
              label="Available From"
              value={availableDate}
              onChange={(e) => setAvailableDate(e.target.value)}
              description="Leave empty for 'Now' (immediately available)"
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setEditField(null)}>Cancel</Button>
            <Button variant="light" color="warning" onPress={() => { setAvailableDate(""); }}>
              Set to Now
            </Button>
            <Button color="primary" isLoading={saving} onPress={handleSave}>Save</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Edit Expiration Date Modal */}
      <Modal isOpen={editField === "expires"} onClose={() => setEditField(null)} size="sm">
        <ModalContent>
          <ModalHeader>Edit Expiration Date</ModalHeader>
          <ModalBody>
            <Input
              type="date"
              label="Expires On"
              value={expirationDate}
              onChange={(e) => setExpirationDate(e.target.value)}
              description="Leave empty for 'Never' (no expiration)"
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setEditField(null)}>Cancel</Button>
            <Button variant="light" color="warning" onPress={() => { setExpirationDate(""); }}>
              Set to Never
            </Button>
            <Button color="primary" isLoading={saving} onPress={handleSave}>Save</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Edit Access Mode Modal */}
      <Modal isOpen={editField === "access"} onClose={() => setEditField(null)} size="sm">
        <ModalContent>
          <ModalHeader>Edit Access Mode</ModalHeader>
          <ModalBody>
            <Select
              label="Access Mode"
              selectedKeys={[accessMode]}
              onSelectionChange={(keys) => {
                const selected = Array.from(keys)[0] as string;
                if (selected === "anyone" || selected === "specific") {
                  setAccessMode(selected);
                }
              }}
            >
              <SelectItem key="anyone">Open - Anyone with code can join</SelectItem>
              <SelectItem key="specific">Restricted - Only invited emails</SelectItem>
            </Select>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setEditField(null)}>Cancel</Button>
            <Button color="primary" isLoading={saving} onPress={handleSave}>Save</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
