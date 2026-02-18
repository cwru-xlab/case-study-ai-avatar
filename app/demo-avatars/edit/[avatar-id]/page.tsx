"use client";

import { useParams, useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Chip } from "@heroui/chip";
import { ArrowLeft, Save, Trash2, Globe, FileText } from "lucide-react";
import { mockAvatars } from "@/lib/mock-avatars";
import AvatarImage from "@/components/AvatarImage";

// Helper to get title
function getTitleForAvatar(id: string): string {
  const titles: Record<string, string> = {
    "helpful-assistant": "General Purpose AI Assistant",
    "creative-writer": "Creative Writing Specialist",
    "technical-expert": "Senior Technical Consultant",
    "friendly-tutor": "Educational Coach",
    "cat-assistant": "Feline Companion Assistant",
    "business-analyst": "Strategic Business Advisor",
    "code-reviewer": "Software Quality Engineer",
    "wellness-coach": "Mental Health & Wellness Guide",
  };
  return titles[id] || "AI Assistant";
}

export default function EditAvatarPage() {
  const params = useParams();
  const router = useRouter();
  const avatarId = params["avatar-id"] as string;

  // Find the avatar from mock data
  const avatar = mockAvatars.find((a) => a.id === avatarId);

  if (!avatar) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-2xl font-bold mb-4">Avatar Not Found</h1>
          <p className="text-default-600 mb-6">
            The avatar with ID &quot;{avatarId}&quot; could not be found.
          </p>
          <Button color="primary" onPress={() => router.push("/demo-avatars")}>
            Back to Avatars
          </Button>
        </div>
      </div>
    );
  }

  const isPublished = mockAvatars.indexOf(avatar) < 6;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="light"
            startContent={<ArrowLeft className="w-4 h-4" />}
            onPress={() => router.push("/demo-avatars")}
          >
            Back to Avatars
          </Button>
          <div className="flex gap-2">
            <Button
              color="danger"
              variant="flat"
              startContent={<Trash2 className="w-4 h-4" />}
              onPress={() => alert("Delete functionality coming soon!")}
            >
              Delete
            </Button>
            <Button
              color="primary"
              startContent={<Save className="w-4 h-4" />}
              onPress={() => alert("Save functionality coming soon!")}
            >
              Save Changes
            </Button>
          </div>
        </div>

        {/* Avatar Info Card */}
        <Card className="mb-6">
          <CardHeader className="flex gap-4 p-6">
            <AvatarImage name={avatar.name} size={80} />
            <div className="flex flex-col justify-center flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-2xl font-bold">Edit Avatar</h1>
                <Chip
                  size="sm"
                  color={isPublished ? "success" : "default"}
                  variant={isPublished ? "solid" : "bordered"}
                  startContent={
                    isPublished ? (
                      <Globe className="w-3 h-3" />
                    ) : (
                      <FileText className="w-3 h-3" />
                    )
                  }
                >
                  {isPublished ? "Published" : "Draft"}
                </Chip>
              </div>
              <p className="text-default-500 font-mono text-sm">ID: {avatar.id}</p>
            </div>
          </CardHeader>
        </Card>

        {/* Edit Form Placeholder */}
        <Card>
          <CardBody className="p-6 space-y-6">
            <div className="bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800 rounded-lg p-4 mb-4">
              <p className="text-warning-700 dark:text-warning-400 text-sm">
                This is a placeholder edit page. Full editing functionality will be implemented soon.
              </p>
            </div>

            {/* Name Field */}
            <div>
              <label className="block text-sm font-medium mb-2">Avatar Name</label>
              <Input
                defaultValue={avatar.name}
                placeholder="Enter avatar name"
                variant="bordered"
                isReadOnly
              />
            </div>

            {/* Title Field */}
            <div>
              <label className="block text-sm font-medium mb-2">Title</label>
              <Input
                defaultValue={getTitleForAvatar(avatar.id)}
                placeholder="Enter professional title"
                variant="bordered"
                isReadOnly
              />
            </div>

            {/* System Prompt Field */}
            <div>
              <label className="block text-sm font-medium mb-2">System Prompt</label>
              <textarea
                className="w-full min-h-[120px] p-3 rounded-lg border-2 border-default-200 bg-default-100 text-default-700 resize-y"
                defaultValue={avatar.systemPrompt}
                placeholder="Enter system prompt"
                readOnly
              />
            </div>

            {/* Description Field */}
            <div>
              <label className="block text-sm font-medium mb-2">Description</label>
              <textarea
                className="w-full min-h-[80px] p-3 rounded-lg border-2 border-default-200 bg-default-100 text-default-700 resize-y"
                defaultValue={avatar.description || ""}
                placeholder="Enter description"
                readOnly
              />
            </div>

            {/* Metadata */}
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-default-200">
              <div>
                <label className="block text-sm font-medium mb-2">Created By</label>
                <Input
                  defaultValue={avatar.createdBy}
                  variant="bordered"
                  isReadOnly
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Last Edited By</label>
                <Input
                  defaultValue={avatar.lastEditedBy}
                  variant="bordered"
                  isReadOnly
                />
              </div>
            </div>

            {/* Timestamps */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Created At</label>
                <Input
                  defaultValue={new Date(avatar.createdAt).toLocaleString()}
                  variant="bordered"
                  isReadOnly
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Last Edited At</label>
                <Input
                  defaultValue={new Date(avatar.lastEditedAt).toLocaleString()}
                  variant="bordered"
                  isReadOnly
                />
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
