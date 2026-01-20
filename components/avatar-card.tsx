"use client";

import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { AlertCircle, Globe, FileText } from "lucide-react";
import { getFirstSentence, getRelativeTime } from "@/lib/mock-avatars";
import { type CachedAvatar } from "@/lib/avatar-storage";
import AvatarImage from "./AvatarImage";

interface AvatarCardProps {
  avatar: CachedAvatar;
  onClick: (avatarId: string) => void;
  isDirty?: boolean;
}

export default function AvatarCard({
  avatar,
  onClick,
  isDirty,
}: AvatarCardProps) {
  const handleCardClick = () => {
    onClick(avatar.id);
  };

  return (
    <Card
      className="h-full cursor-pointer hover:shadow-lg transition-shadow duration-200"
      isPressable
      onPress={handleCardClick}
    >
      <CardHeader className="flex gap-3">
        <AvatarImage name={avatar.name} portrait={avatar.portrait} size={48} />
        <div className="flex flex-col flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-md font-semibold">{avatar.name}</p>
            <Chip
              size="sm"
              color={avatar.published ? "success" : "default"}
              variant={avatar.published ? "solid" : "bordered"}
              startContent={
                avatar.published ? (
                  <Globe className="w-3 h-3" />
                ) : (
                  <FileText className="w-3 h-3" />
                )
              }
            >
              {avatar.published ? "Published" : "Draft"}
            </Chip>
            {(isDirty || avatar.isDirty) && (
              <div className="flex items-center gap-1 text-warning">
                <AlertCircle className="w-3 h-3" />
                <span className="text-xs">Unsaved</span>
              </div>
            )}
          </div>
          <p className="flex items-center text-small text-default-500 font-mono">
            {avatar.id}
          </p>
        </div>
      </CardHeader>
      <CardBody className="pt-0">
        <div className="space-y-3">
          {/* First sentence of system prompt */}
          <div>
            <p className="text-sm text-default-600">
              {getFirstSentence(avatar.systemPrompt)}
            </p>
          </div>

          {/* Creator and editor info */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-default-500">Created by:</span>
              <div className="flex items-center gap-1">
                <span className="text-xs font-medium">{avatar.createdBy}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-default-500">Last edited by:</span>
              <div className="flex items-center gap-1">
                <span className="text-xs font-medium">
                  {avatar.lastEditedBy}
                </span>
              </div>
            </div>
          </div>

          {/* Last edit time */}
          <div className="pt-2 border-t border-default-200">
            <p className="text-xs text-default-400">
              Last edited {getRelativeTime(avatar.lastEditedAt)}
            </p>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
