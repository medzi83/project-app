"use client";

import { deletePreviewVersion } from "./actions";

type Props = {
  versionId: string;
  projectId: string;
  version: number;
};

export default function DeleteVersionButton({ versionId, projectId, version }: Props) {
  const handleDelete = async () => {
    if (!confirm(`Version ${version} wirklich löschen?`)) {
      return;
    }

    const formData = new FormData();
    formData.append("versionId", versionId);
    formData.append("projectId", projectId);

    await deletePreviewVersion(formData);
  };

  return (
    <button
      type="button"
      onClick={handleDelete}
      className="text-xs text-red-600 hover:text-red-800 px-2 py-1 rounded border border-red-300 hover:bg-red-50"
    >
      Löschen
    </button>
  );
}
