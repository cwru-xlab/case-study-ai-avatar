"use client";

// SECURITY: Only show test pages in development mode
if (typeof window !== "undefined" && process.env.NODE_ENV !== "development") {
  throw new Error("Test pages are only available in development mode");
}

import { Card, CardBody } from "@heroui/card";
import { Button } from "@heroui/button";
import NextLink from "next/link";
import { title, subtitle } from "@/components/primitives";
import {
  FlaskConical,
  MessageSquare,
  CloudDownload,
  BrainCircuit,
  HardDrive,
} from "lucide-react";

const testPages = [
  {
    id: "test-chat-storage",
    title: "Chat Storage Test",
    description:
      "Test chat storage functionality including save, list, get, and delete operations",
    href: "/test-pages/test-chat-storage",
    icon: MessageSquare,
    color: "primary" as const,
  },
  {
    id: "test-s3-permissions",
    title: "S3 Permissions Test",
    description: "Diagnostic tool to test S3 permissions and AWS configuration",
    href: "/test-pages/test-s3-permissions",
    icon: CloudDownload,
    color: "secondary" as const,
  },
  {
    id: "test-llm-knowledge",
    title: "LLM & Knowledge Test",
    description: "Test LLM API endpoints and knowledge search functionality",
    href: "/test-pages/test-llm-knowledge",
    icon: BrainCircuit,
    color: "success" as const,
  },
  {
    id: "test-s3-file-manager",
    title: "S3 File Manager",
    description:
      "Comprehensive S3 file management: list, download, and delete files with modal confirmations",
    href: "/test-pages/test-s3-file-manager",
    icon: HardDrive,
    color: "warning" as const,
  },
];

export default function TestPagesIndex() {
  return (
    <section className="flex flex-col items-center justify-center gap-4 py-8 md:py-10 max-w-4xl mx-auto">
      <div className="text-center">
        <h1 className={title()}>Test Pages</h1>
        <p className={subtitle({ class: "mt-4" })}>
          Development and testing utilities
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full mt-8">
        {testPages.map((page) => {
          const IconComponent = page.icon;
          return (
            <Card key={page.id} className="hover:shadow-lg transition-shadow">
              <CardBody className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`p-2 rounded-lg bg-${page.color}/10`}>
                    <IconComponent className={`text-${page.color}`} size={24} />
                  </div>
                  <h3 className="text-lg font-semibold">{page.title}</h3>
                </div>

                <p className="text-default-600 mb-6 text-sm">
                  {page.description}
                </p>

                <Button
                  as={NextLink}
                  href={page.href}
                  color={page.color}
                  variant="flat"
                  className="w-full"
                >
                  Open Test Page
                </Button>
              </CardBody>
            </Card>
          );
        })}
      </div>

      <div className="mt-8 p-4 bg-warning-50 dark:bg-warning-900/20 rounded-lg border border-warning-200 dark:border-warning-700">
        <div className="flex items-center gap-2 mb-2">
          <FlaskConical className="text-warning-600" size={20} />
          <span className="font-semibold text-warning-800 dark:text-warning-200">
            Development Only
          </span>
        </div>
        <p className="text-warning-700 dark:text-warning-300 text-sm">
          These test pages are only available in development mode and require
          admin privileges.
        </p>
      </div>
    </section>
  );
}
