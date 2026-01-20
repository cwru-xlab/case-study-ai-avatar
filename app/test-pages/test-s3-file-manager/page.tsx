"use client";

import { useState, useEffect } from "react";

// SECURITY: Only show this page in development mode
if (typeof window !== "undefined" && process.env.NODE_ENV !== "development") {
  throw new Error("S3 File Manager is only available in development mode");
}
import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Input } from "@heroui/input";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@heroui/modal";
import { Select, SelectItem } from "@heroui/select";
import { Spinner } from "@heroui/spinner";
import { Tooltip } from "@heroui/tooltip";
import { Progress } from "@heroui/progress";
import {
  Cloud,
  Download,
  Trash2,
  RefreshCw,
  Search,
  File,
  Folder,
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronRight,
  ChevronDown,
  FolderOpen,
  List,
  TreePine,
} from "lucide-react";

interface S3File {
  key: string;
  size: number;
  lastModified: string;
  etag: string;
}

interface TreeNode {
  name: string;
  fullPath: string;
  isFolder: boolean;
  file?: S3File;
  children: Map<string, TreeNode>;
  isExpanded?: boolean;
}

interface DeleteModalState {
  isOpen: boolean;
  file: S3File | null;
  node: TreeNode | null;
}

interface OperationResult {
  type: "success" | "error" | "info";
  message: string;
  timestamp: string;
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleString();
};

const getFileIcon = (key: string) => {
  if (key.endsWith("/")) return <Folder className="text-blue-500" size={20} />;
  return <File className="text-gray-500" size={20} />;
};

const isFolder = (key: string) => key.endsWith("/");

const getFolderName = (key: string) => {
  const parts = key.replace(/\/$/, "").split("/");
  return parts[parts.length - 1] || key;
};

// Build tree structure from flat file list
const buildFileTree = (files: S3File[]): TreeNode => {
  const root: TreeNode = {
    name: "root",
    fullPath: "",
    isFolder: true,
    children: new Map(),
    isExpanded: true,
  };

  files.forEach((file) => {
    const parts = file.key.split("/").filter((part) => part !== "");
    let currentNode = root;
    let currentPath = "";

    parts.forEach((part, index) => {
      currentPath += (currentPath ? "/" : "") + part;
      const isLastPart = index === parts.length - 1;
      const isFileNode = isLastPart && !file.key.endsWith("/");

      if (!currentNode.children.has(part)) {
        currentNode.children.set(part, {
          name: part,
          fullPath: currentPath + (isFileNode ? "" : "/"),
          isFolder: !isFileNode,
          file: isFileNode ? file : undefined,
          children: new Map(),
          isExpanded: false,
        });
      }

      currentNode = currentNode.children.get(part)!;
      if (isFileNode && !currentNode.file) {
        currentNode.file = file;
      }
    });
  });

  return root;
};

// TreeNode component for recursive rendering
const TreeNodeComponent: React.FC<{
  node: TreeNode;
  level: number;
  onToggleExpand: (node: TreeNode) => void;
  onDownload: (file: S3File) => void;
  onDelete: (node: TreeNode) => void;
  downloadProgress: { [key: string]: boolean };
}> = ({
  node,
  level,
  onToggleExpand,
  onDownload,
  onDelete,
  downloadProgress,
}) => {
  const indent = level * 20;

  if (node.isFolder) {
    const childrenArray = Array.from(node.children.values());
    const hasChildren = childrenArray.length > 0;

    return (
      <div>
        <div
          className={`flex items-center justify-between p-2 rounded hover:bg-gray-50 transition-colors`}
          style={{ paddingLeft: `${indent + 8}px` }}
        >
          <button
            className="flex items-center gap-2 flex-1 min-w-0 text-left bg-transparent border-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 rounded px-1 py-1"
            onClick={() => hasChildren && onToggleExpand(node)}
            disabled={!hasChildren}
            aria-expanded={hasChildren ? node.isExpanded : undefined}
            aria-label={
              hasChildren
                ? `${node.isExpanded ? "Collapse" : "Expand"} folder ${node.name}`
                : `Folder ${node.name} (empty)`
            }
            type="button"
          >
            {hasChildren &&
              (node.isExpanded ? (
                <ChevronDown size={16} className="text-gray-400" />
              ) : (
                <ChevronRight size={16} className="text-gray-400" />
              ))}
            {!hasChildren && <div className="w-4" />}
            {node.isExpanded ? (
              <FolderOpen className="text-blue-500" size={18} />
            ) : (
              <Folder className="text-blue-500" size={18} />
            )}
            <span className="font-medium text-sm truncate">
              {node.name || "Root"}/
            </span>
            {hasChildren && (
              <span className="text-xs text-gray-500">
                ({childrenArray.length} item
                {childrenArray.length !== 1 ? "s" : ""})
              </span>
            )}
          </button>

          {node.fullPath && (
            <div className="flex items-center gap-1">
              <Tooltip content="Delete entire folder">
                <Button
                  isIconOnly
                  size="sm"
                  variant="flat"
                  color="danger"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(node);
                  }}
                  startContent={<Trash2 size={14} />}
                />
              </Tooltip>
            </div>
          )}
        </div>

        {node.isExpanded && hasChildren && (
          <div>
            {childrenArray
              .sort((a, b) => {
                // Folders first, then files
                if (a.isFolder !== b.isFolder) {
                  return a.isFolder ? -1 : 1;
                }
                return a.name.localeCompare(b.name);
              })
              .map((child) => (
                <TreeNodeComponent
                  key={child.fullPath}
                  node={child}
                  level={level + 1}
                  onToggleExpand={onToggleExpand}
                  onDownload={onDownload}
                  onDelete={onDelete}
                  downloadProgress={downloadProgress}
                />
              ))}
          </div>
        )}
      </div>
    );
  } else {
    // File node
    return (
      <div
        className="flex items-center justify-between p-2 rounded hover:bg-gray-50 transition-colors"
        style={{ paddingLeft: `${indent + 28}px` }}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <File className="text-gray-500" size={16} />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{node.name}</p>
            {node.file && (
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span>{formatFileSize(node.file.size)}</span>
                <span>{formatDate(node.file.lastModified)}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {node.file && (
            <Tooltip content="Download file">
              <Button
                isIconOnly
                size="sm"
                variant="flat"
                color="primary"
                onClick={() => onDownload(node.file!)}
                disabled={downloadProgress[node.file.key]}
                startContent={
                  downloadProgress[node.file.key] ? (
                    <Spinner size="sm" />
                  ) : (
                    <Download size={14} />
                  )
                }
              />
            </Tooltip>
          )}
          <Tooltip content="Delete file">
            <Button
              isIconOnly
              size="sm"
              variant="flat"
              color="danger"
              onClick={() => onDelete(node)}
              startContent={<Trash2 size={14} />}
            />
          </Tooltip>
        </div>
      </div>
    );
  }
};

export default function TestS3FileManagerPage() {
  const [files, setFiles] = useState<S3File[]>([]);
  const [filteredFiles, setFilteredFiles] = useState<S3File[]>([]);
  const [fileTree, setFileTree] = useState<TreeNode | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [prefixFilter, setPrefixFilter] = useState("");
  const [maxKeys, setMaxKeys] = useState("500");
  const [results, setResults] = useState<OperationResult[]>([]);
  const [deleteModal, setDeleteModal] = useState<DeleteModalState>({
    isOpen: false,
    file: null,
    node: null,
  });
  const [downloadProgress, setDownloadProgress] = useState<{
    [key: string]: boolean;
  }>({});
  const [viewMode, setViewMode] = useState<"tree" | "list">("tree");

  const {
    isOpen: isDeleteModalOpen,
    onOpen: onDeleteModalOpen,
    onClose: onDeleteModalClose,
  } = useDisclosure();

  // Add result to history
  const addResult = (type: OperationResult["type"], message: string) => {
    const result: OperationResult = {
      type,
      message,
      timestamp: new Date().toLocaleTimeString(),
    };
    setResults((prev) => [result, ...prev].slice(0, 20)); // Keep only last 20 results
  };

  // Load files from S3
  const loadFiles = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (prefixFilter) params.append("prefix", prefixFilter);
      params.append("maxKeys", maxKeys);

      const response = await fetch(`/api/s3-test/list?${params}`);
      const data = await response.json();

      if (response.ok && data.success) {
        setFiles(data.files);
        addResult(
          "success",
          `Loaded ${data.files.length} files${data.truncated ? " (truncated)" : ""}`
        );
      } else {
        addResult("error", data.error || "Failed to load files");
        setFiles([]);
      }
    } catch (error) {
      addResult(
        "error",
        error instanceof Error ? error.message : "Network error"
      );
      setFiles([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter files based on search query and build tree
  useEffect(() => {
    if (!searchQuery) {
      setFilteredFiles(files);
    } else {
      const filtered = files.filter((file) =>
        file.key.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredFiles(filtered);
    }

    // Build tree structure
    const tree = buildFileTree(searchQuery ? filteredFiles : files);
    setFileTree(tree);
  }, [files, searchQuery, filteredFiles]);

  // Download file
  const downloadFile = async (file: S3File) => {
    setDownloadProgress((prev) => ({ ...prev, [file.key]: true }));
    try {
      const params = new URLSearchParams();
      params.append("key", file.key);

      const response = await fetch(`/api/s3-test/download?${params}`);

      if (response.ok) {
        // Create download link
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const filename = file.key.split("/").pop() || "download";

        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        addResult("success", `Downloaded: ${file.key}`);
      } else {
        const errorData = await response.json();
        addResult("error", `Download failed: ${errorData.error}`);
      }
    } catch (error) {
      addResult(
        "error",
        `Download failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setDownloadProgress((prev) => ({ ...prev, [file.key]: false }));
    }
  };

  // Toggle folder expansion
  const toggleFolderExpansion = (targetNode: TreeNode) => {
    if (!fileTree) return;

    const updateNodeExpansion = (node: TreeNode): TreeNode => {
      if (node.fullPath === targetNode.fullPath) {
        return { ...node, isExpanded: !node.isExpanded };
      }

      const updatedChildren = new Map();
      node.children.forEach((child, key) => {
        updatedChildren.set(key, updateNodeExpansion(child));
      });

      return { ...node, children: updatedChildren };
    };

    setFileTree(updateNodeExpansion(fileTree));
  };

  // Open delete modal for tree node
  const openDeleteModalForNode = (node: TreeNode) => {
    const file = node.file || {
      key: node.fullPath,
      size: 0,
      lastModified: new Date().toISOString(),
      etag: "",
    };
    setDeleteModal({ isOpen: true, file, node });
    onDeleteModalOpen();
  };

  // Close delete modal
  const closeDeleteModal = () => {
    setDeleteModal({ isOpen: false, file: null, node: null });
    onDeleteModalClose();
  };

  // Delete file or folder
  const deleteFileOrFolder = async () => {
    if (!deleteModal.file || !deleteModal.node) return;

    const nodeIsFolder = deleteModal.node.isFolder;

    try {
      const response = await fetch("/api/s3-test/delete", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          key: deleteModal.file.key,
          isFolder: nodeIsFolder,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        const resultMessage = nodeIsFolder
          ? `Deleted folder: ${deleteModal.file.key} (${data.deletedCount || 0} objects)`
          : `Deleted file: ${deleteModal.file.key}`;
        addResult("success", resultMessage);

        // Remove file/folder from local state
        if (nodeIsFolder) {
          // Remove all files that start with this prefix
          const folderPrefix = deleteModal.file.key;
          setFiles((prev) =>
            prev.filter((f) => !f.key.startsWith(folderPrefix))
          );
        } else {
          setFiles((prev) =>
            prev.filter((f) => f.key !== deleteModal.file!.key)
          );
        }
      } else {
        addResult("error", `Delete failed: ${data.error}`);
      }
    } catch (error) {
      addResult(
        "error",
        `Delete failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      closeDeleteModal();
    }
  };

  // Load files on component mount
  useEffect(() => {
    loadFiles();
  }, []);

  const clearResults = () => setResults([]);

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
          <Cloud className="text-blue-500" size={32} />
          S3 File Manager
        </h1>
        <p className="text-gray-600">
          Comprehensive S3 file management tool for testing file operations.
          List, download, and delete files/folders with modal confirmations.
        </p>
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-amber-800 text-sm font-medium">
            🔒 Development Only
          </p>
          <p className="text-amber-700 text-xs mt-1">
            This tool is only available in development mode for security
            reasons.
          </p>
        </div>
      </div>

      {/* Controls */}
      <Card className="mb-6">
        <CardHeader>
          <h2 className="text-xl font-semibold">File Operations</h2>
        </CardHeader>
        <CardBody className="space-y-4">
          {/* Filter Controls */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Prefix Filter"
              placeholder="e.g., avatars/, chats/"
              value={prefixFilter}
              onChange={(e) => setPrefixFilter(e.target.value)}
              startContent={<Folder size={18} className="text-gray-400" />}
            />
            <Select
              label="Max Results"
              placeholder="Select max files"
              selectedKeys={[maxKeys]}
              onSelectionChange={(keys) =>
                setMaxKeys(Array.from(keys)[0] as string)
              }
            >
              <SelectItem key="10">10 files</SelectItem>
              <SelectItem key="50">50 files</SelectItem>
              <SelectItem key="100">100 files</SelectItem>
              <SelectItem key="200">200 files</SelectItem>
              <SelectItem key="500">500 files</SelectItem>
            </Select>
            <div className="flex gap-2">
              <Button
                onClick={loadFiles}
                disabled={isLoading}
                color="primary"
                className="flex-1"
                startContent={<RefreshCw size={18} />}
              >
                {isLoading ? "Loading..." : "Refresh"}
              </Button>
              <Tooltip
                content={
                  viewMode === "tree"
                    ? "Switch to List View"
                    : "Switch to Tree View"
                }
              >
                <Button
                  isIconOnly
                  onClick={() =>
                    setViewMode(viewMode === "tree" ? "list" : "tree")
                  }
                  color="secondary"
                  variant="flat"
                  startContent={
                    viewMode === "tree" ? (
                      <List size={18} />
                    ) : (
                      <TreePine size={18} />
                    )
                  }
                />
              </Tooltip>
            </div>
          </div>

          {/* Search */}
          <Input
            label="Search Files"
            placeholder="Search by filename or path..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            startContent={<Search size={18} className="text-gray-400" />}
            description={`Showing ${filteredFiles.length} of ${files.length} files`}
          />
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* File List */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold">Files</h2>
                <Chip
                  size="sm"
                  variant="flat"
                  color={viewMode === "tree" ? "primary" : "default"}
                >
                  {viewMode === "tree" ? "Tree View" : "List View"}
                </Chip>
              </div>
              <div className="flex items-center gap-2">
                {isLoading && <Spinner size="sm" />}
                <Chip size="sm" variant="bordered">
                  {filteredFiles.length} files
                </Chip>
              </div>
            </CardHeader>
            <CardBody>
              {filteredFiles.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {isLoading ? (
                    <div className="flex items-center justify-center gap-2">
                      <Spinner size="sm" />
                      <span>Loading files...</span>
                    </div>
                  ) : files.length === 0 ? (
                    "No files found. Try refreshing or adjusting filters."
                  ) : (
                    "No files match your search query."
                  )}
                </div>
              ) : viewMode === "tree" && fileTree ? (
                <div className="max-h-96 overflow-y-auto">
                  {Array.from(fileTree.children.values())
                    .sort((a, b) => {
                      // Folders first, then files
                      if (a.isFolder !== b.isFolder) {
                        return a.isFolder ? -1 : 1;
                      }
                      return a.name.localeCompare(b.name);
                    })
                    .map((child) => (
                      <TreeNodeComponent
                        key={child.fullPath}
                        node={child}
                        level={0}
                        onToggleExpand={toggleFolderExpansion}
                        onDownload={downloadFile}
                        onDelete={openDeleteModalForNode}
                        downloadProgress={downloadProgress}
                      />
                    ))}
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {filteredFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {getFileIcon(file.key)}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate text-sm">
                            {file.key}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span>{formatFileSize(file.size)}</span>
                            <span>{formatDate(file.lastModified)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {!isFolder(file.key) && (
                          <Tooltip content="Download file">
                            <Button
                              isIconOnly
                              size="sm"
                              variant="flat"
                              color="primary"
                              onClick={() => downloadFile(file)}
                              disabled={downloadProgress[file.key]}
                              startContent={
                                downloadProgress[file.key] ? (
                                  <Spinner size="sm" />
                                ) : (
                                  <Download size={16} />
                                )
                              }
                            />
                          </Tooltip>
                        )}
                        <Tooltip
                          content={
                            isFolder(file.key)
                              ? "Delete entire folder"
                              : "Delete file"
                          }
                        >
                          <Button
                            isIconOnly
                            size="sm"
                            variant="flat"
                            color="danger"
                            onClick={() => {
                              const file_copy = file;
                              const node: TreeNode = {
                                name: file.key.split("/").pop() || file.key,
                                fullPath: file.key,
                                isFolder: isFolder(file.key),
                                file: isFolder(file.key) ? undefined : file,
                                children: new Map(),
                              };
                              openDeleteModalForNode(node);
                            }}
                            startContent={<Trash2 size={16} />}
                          />
                        </Tooltip>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Operation History */}
        <div>
          <Card>
            <CardHeader className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Operation History</h2>
              <Button
                size="sm"
                variant="flat"
                onClick={clearResults}
                disabled={results.length === 0}
              >
                Clear
              </Button>
            </CardHeader>
            <CardBody>
              {results.length === 0 ? (
                <p className="text-gray-500 italic text-sm">
                  No operations yet.
                </p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {results.map((result, index) => (
                    <div
                      key={index}
                      className={`p-2 rounded text-xs border-l-2 ${
                        result.type === "success"
                          ? "bg-green-50 border-green-500 text-green-700"
                          : result.type === "error"
                            ? "bg-red-50 border-red-500 text-red-700"
                            : "bg-blue-50 border-blue-500 text-blue-700"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-1">
                          {result.type === "success" && (
                            <CheckCircle size={12} className="mt-0.5" />
                          )}
                          {result.type === "error" && (
                            <XCircle size={12} className="mt-0.5" />
                          )}
                          {result.type === "info" && (
                            <AlertTriangle size={12} className="mt-0.5" />
                          )}
                          <span className="flex-1">{result.message}</span>
                        </div>
                        <span className="text-xs opacity-60 whitespace-nowrap">
                          {result.timestamp}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={isDeleteModalOpen} onClose={closeDeleteModal}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex items-center gap-2">
                <AlertTriangle className="text-red-500" size={20} />
                Confirm Deletion
              </ModalHeader>
              <ModalBody>
                {deleteModal.node && deleteModal.node.isFolder ? (
                  <>
                    <p>
                      Are you sure you want to delete this{" "}
                      <strong>entire folder</strong> and all its contents?
                    </p>
                    <div className="bg-red-50 border border-red-200 p-3 rounded mt-2">
                      <div className="flex items-center gap-2 mb-2">
                        <Folder className="text-red-600" size={16} />
                        <p className="font-medium text-sm text-red-800 break-all">
                          {deleteModal.node.name}/
                        </p>
                      </div>
                      <p className="text-xs text-red-600">
                        Folder path: {deleteModal.node.fullPath}
                      </p>
                    </div>
                    <p className="text-red-600 text-sm">
                      <strong>⚠️ DANGER:</strong> This will permanently delete
                      ALL files in this folder and any subfolders. This action
                      cannot be undone!
                    </p>
                  </>
                ) : (
                  <>
                    <p>Are you sure you want to delete this file?</p>
                    {deleteModal.file && (
                      <div className="bg-gray-100 p-3 rounded mt-2">
                        <p className="font-medium text-sm break-all">
                          {deleteModal.file.key}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          Size: {formatFileSize(deleteModal.file.size)} •
                          Modified: {formatDate(deleteModal.file.lastModified)}
                        </p>
                      </div>
                    )}
                    <p className="text-red-600 text-sm">
                      <strong>Warning:</strong> This action cannot be undone.
                    </p>
                  </>
                )}
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={onClose}>
                  Cancel
                </Button>
                <Button color="danger" onPress={deleteFileOrFolder}>
                  {deleteModal.node && deleteModal.node.isFolder
                    ? "Delete Entire Folder"
                    : "Delete File"}
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
