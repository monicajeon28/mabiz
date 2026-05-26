"use client";

import { useState } from "react";
import { SequenceList } from "./sequence-list";
import { SequenceEditor } from "./sequence-editor";
import { SequencePreview } from "./sequence-preview";
import { SequenceAnalytics } from "./sequence-analytics";
import { DeployModal } from "./deploy-modal";

type TabType = "list" | "editor" | "preview" | "analytics" | "deploy";

interface SequenceTabProps {
  organizationId?: string;
}

export function SequenceTab({ organizationId }: SequenceTabProps) {
  const [activeTab, setActiveTab] = useState<TabType>("list");
  const [selectedSequenceId, setSelectedSequenceId] = useState<string | null>(null);
  const [isDeployModalOpen, setIsDeployModalOpen] = useState(false);

  // Handle sequence selection from list
  const handleSelectSequence = (id: string) => {
    setSelectedSequenceId(id);
    setActiveTab("preview");
  };

  // Handle edit from list
  const handleEditSequence = (id: string) => {
    setSelectedSequenceId(id);
    setActiveTab("editor");
  };

  // Handle analytics from list
  const handleViewAnalytics = (id: string) => {
    setSelectedSequenceId(id);
    setActiveTab("analytics");
  };

  // Handle deploy from list
  const handleDeploy = (id: string) => {
    setSelectedSequenceId(id);
    setIsDeployModalOpen(true);
  };

  // Handle create new sequence
  const handleCreateNew = () => {
    setSelectedSequenceId(null);
    setActiveTab("editor");
  };

  // Handle back to list
  const handleBackToList = () => {
    setActiveTab("list");
    setSelectedSequenceId(null);
  };

  return (
    <div className="space-y-4">
      {/* Tab Navigation */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div className="flex gap-1 p-4 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setActiveTab("list")}
            className={`px-4 py-2 rounded-lg whitespace-nowrap font-medium transition-colors ${
              activeTab === "list"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            목록
          </button>

          {selectedSequenceId && (
            <>
              <button
                onClick={() => setActiveTab("editor")}
                className={`px-4 py-2 rounded-lg whitespace-nowrap font-medium transition-colors ${
                  activeTab === "editor"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                편집
              </button>

              <button
                onClick={() => setActiveTab("preview")}
                className={`px-4 py-2 rounded-lg whitespace-nowrap font-medium transition-colors ${
                  activeTab === "preview"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                미리보기
              </button>

              <button
                onClick={() => setActiveTab("analytics")}
                className={`px-4 py-2 rounded-lg whitespace-nowrap font-medium transition-colors ${
                  activeTab === "analytics"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                분석
              </button>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pb-8">
        {activeTab === "list" && (
          <SequenceList
            organizationId={organizationId}
            onSelectSequence={handleSelectSequence}
            onEditSequence={handleEditSequence}
            onViewAnalytics={handleViewAnalytics}
            onDeploySequence={handleDeploy}
            onCreateNew={handleCreateNew}
          />
        )}

        {activeTab === "editor" && selectedSequenceId && (
          <SequenceEditor
            sequenceId={selectedSequenceId}
            onBack={handleBackToList}
            onSaved={() => {
              handleBackToList();
            }}
          />
        )}

        {activeTab === "editor" && !selectedSequenceId && (
          <SequenceEditor
            sequenceId={null}
            onBack={handleBackToList}
            onSaved={() => {
              handleBackToList();
            }}
          />
        )}

        {activeTab === "preview" && selectedSequenceId && (
          <SequencePreview
            sequenceId={selectedSequenceId}
            onBack={handleBackToList}
          />
        )}

        {activeTab === "analytics" && selectedSequenceId && (
          <SequenceAnalytics
            sequenceId={selectedSequenceId}
            onBack={handleBackToList}
          />
        )}
      </div>

      {/* Deploy Modal */}
      {isDeployModalOpen && selectedSequenceId && (
        <DeployModal
          sequenceId={selectedSequenceId}
          isOpen={isDeployModalOpen}
          onClose={() => {
            setIsDeployModalOpen(false);
            handleBackToList();
          }}
          onDeployed={() => {
            setIsDeployModalOpen(false);
            handleBackToList();
          }}
        />
      )}
    </div>
  );
}
