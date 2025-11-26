"use client";

import { useState } from "react";
import Image from "next/image";
import { Upload, X, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

type AgencyLogoUploadProps = {
  agencyId: string;
  agencyName: string;
  currentLogoPath?: string | null;
  currentLogoIconPath?: string | null;
};

export default function AgencyLogoUpload({
  agencyId,
  agencyName,
  currentLogoPath,
  currentLogoIconPath,
}: AgencyLogoUploadProps) {
  const [logoPath, setLogoPath] = useState(currentLogoPath);
  const [logoIconPath, setLogoIconPath] = useState(currentLogoIconPath);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsUploading(true);
    setError(null);

    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch(`/api/admin/agencies/${agencyId}/upload-logo`, {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Upload fehlgeschlagen");
      }

      setLogoPath(result.logoPath);
      setLogoIconPath(result.logoIconPath);

      // Reset form if it still exists
      const form = event.currentTarget;
      if (form) {
        form.reset();
      }

      // Reload page to update
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Hochladen");
      setIsUploading(false);
    }
  };

  const handleDelete = async (type: "logo" | "icon") => {
    if (!confirm(`Möchten Sie das ${type === "logo" ? "Logo" : "Icon"} wirklich löschen?`)) {
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/admin/agencies/${agencyId}/upload-logo?type=${type}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Löschen fehlgeschlagen");
      }

      if (type === "logo") {
        setLogoPath(null);
      } else {
        setLogoIconPath(null);
      }

      // Reload page to update
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Löschen");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {/* Main Logo */}
        <div className="rounded-xl border-2 border-blue-200 dark:border-blue-800 bg-gradient-to-br from-white to-blue-50/30 dark:from-gray-800 dark:to-blue-950/30 p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-bold text-blue-900 dark:text-blue-300">Haupt-Logo</h4>
            {logoPath && (
              <button
                type="button"
                onClick={() => handleDelete("logo")}
                disabled={isUploading}
                className="text-xs text-red-600 hover:text-red-800 font-medium transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {logoPath ? (
            <div className="flex items-center justify-center rounded-lg border-2 border-blue-200 dark:border-blue-700 bg-white dark:bg-gray-800 p-4">
              <Image
                src={logoPath}
                alt={`Logo ${agencyName}`}
                width={200}
                height={100}
                className="max-h-24 w-auto object-contain"
                unoptimized
              />
            </div>
          ) : (
            <div className="flex h-32 items-center justify-center rounded-lg border-2 border-dashed border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-950/30">
              <div className="text-center">
                <ImageIcon className="mx-auto h-8 w-8 text-blue-400 dark:text-blue-500" />
                <p className="mt-2 text-xs text-blue-600 dark:text-blue-400">Kein Logo hochgeladen</p>
              </div>
            </div>
          )}
        </div>

        {/* Icon Logo */}
        <div className="rounded-xl border-2 border-purple-200 dark:border-purple-800 bg-gradient-to-br from-white to-purple-50/30 dark:from-gray-800 dark:to-purple-950/30 p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-bold text-purple-900 dark:text-purple-300">Icon/Favicon</h4>
            {logoIconPath && (
              <button
                type="button"
                onClick={() => handleDelete("icon")}
                disabled={isUploading}
                className="text-xs text-red-600 hover:text-red-800 font-medium transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {logoIconPath ? (
            <div className="flex items-center justify-center rounded-lg border-2 border-purple-200 dark:border-purple-700 bg-white dark:bg-gray-800 p-4">
              <Image
                src={logoIconPath}
                alt={`Icon ${agencyName}`}
                width={64}
                height={64}
                className="h-16 w-16 object-contain"
                unoptimized
              />
            </div>
          ) : (
            <div className="flex h-32 items-center justify-center rounded-lg border-2 border-dashed border-purple-300 dark:border-purple-700 bg-purple-50/50 dark:bg-purple-950/30">
              <div className="text-center">
                <ImageIcon className="mx-auto h-8 w-8 text-purple-400 dark:text-purple-500" />
                <p className="mt-2 text-xs text-purple-600 dark:text-purple-400">Kein Icon hochgeladen</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/50 p-3 text-sm text-red-800 dark:text-red-300">
          {error}
        </div>
      )}

      <form onSubmit={handleUpload} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Haupt-Logo hochladen
            </label>
            <input
              type="file"
              name="logo"
              accept=".png,.jpg,.jpeg,.svg,.webp"
              className="w-full text-sm text-gray-900 dark:text-gray-100 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 dark:file:bg-blue-900/30 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-100 dark:hover:file:bg-blue-900/50"
              disabled={isUploading}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Empfohlen: PNG, SVG oder WEBP (max. 5 MB)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Icon/Favicon hochladen
            </label>
            <input
              type="file"
              name="logoIcon"
              accept=".png,.jpg,.jpeg,.svg,.webp"
              className="w-full text-sm text-gray-900 dark:text-gray-100 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-50 dark:file:bg-purple-900/30 file:text-purple-700 dark:file:text-purple-300 hover:file:bg-purple-100 dark:hover:file:bg-purple-900/50"
              disabled={isUploading}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Empfohlen: Quadratisch, 64x64px oder größer
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={isUploading} className="gap-2">
            <Upload className="h-4 w-4" />
            {isUploading ? "Wird hochgeladen..." : "Logos hochladen"}
          </Button>
        </div>
      </form>
    </div>
  );
}
