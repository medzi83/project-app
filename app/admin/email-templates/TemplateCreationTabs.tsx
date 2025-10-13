'use client';

import { useState } from "react";
import CreateTemplateForm from "./CreateTemplateForm";
import SignatureForm from "./SignatureForm";
import VariableGroupsPanel, { VariableGroup } from "./VariableGroupsPanel";

type SignatureOption = {
  agencyId: string | null;
  label: string;
  body: string;
};

type TemplateCreationTabsProps = {
  variableGroups: VariableGroup[];
  signatureOptions: SignatureOption[];
};

type TabId = "template" | "signature";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "template", label: "Vorlage anlegen" },
  { id: "signature", label: "Signaturen" },
];

export default function TemplateCreationTabs({ variableGroups, signatureOptions }: TemplateCreationTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>("template");

  return (
    <div>
      <div role="tablist" aria-label="Vorlagen und Signatur" className="flex items-end gap-2 border-b border-gray-200">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.id)}
              className={[
                "rounded-t-md px-4 py-2 text-sm font-semibold transition",
                isActive
                  ? "border border-gray-200 border-b-white bg-white text-black -mb-[1px]"
                  : "border border-transparent text-gray-500 hover:text-gray-800",
              ].join(" ")}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        {activeTab === "template" ? (
          <>
            <CreateTemplateForm />
            <VariableGroupsPanel groups={variableGroups} />
          </>
        ) : (
          <>
            <SignatureForm options={signatureOptions} />
            <VariableGroupsPanel groups={variableGroups} />
          </>
        )}
      </div>
    </div>
  );
}
