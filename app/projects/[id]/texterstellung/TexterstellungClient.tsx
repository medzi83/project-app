"use client";

import { useState } from "react";
import { saveTextDraft, markTextAsComplete, markTextAsIncomplete, markAllTextsAsComplete, updateTexterNote } from "./actions";
import type { Texterstellung, TexterstellungItem, TexterstellungVersion } from "@prisma/client";
import { RichTextEditor } from "@/components/ui/rich-text-editor";

type TexterstellungWithItems = Texterstellung & {
  items: (TexterstellungItem & {
    versions: TexterstellungVersion[];
  })[];
};

type Props = {
  texterstellung: TexterstellungWithItems;
  projectId: string;
  menuItemNotes?: Record<string, string>;
  canEdit?: boolean;
};

export default function TexterstellungClient({ texterstellung, projectId, menuItemNotes = {}, canEdit = true }: Props) {
  // Sort items: "Weitere Texte" / "Hinweise" always at the end
  const sortedItems = [...texterstellung.items].sort((a, b) => {
    const isALast = a.menuItemName === "Weitere Texte" || a.menuItemName === "Hinweise";
    const isBLast = b.menuItemName === "Weitere Texte" || b.menuItemName === "Hinweise";
    if (isALast && !isBLast) return 1;
    if (isBLast && !isALast) return -1;
    return a.menuItemName.localeCompare(b.menuItemName);
  });

  // Active tab (selected item)
  const [activeItemId, setActiveItemId] = useState<string>(
    sortedItems[0]?.id || ""
  );

  // Editing state
  const [editingItems, setEditingItems] = useState<Map<string, string>>(new Map());
  const [savingItems, setSavingItems] = useState<Set<string>>(new Set());
  const [completingItems, setCompletingItems] = useState<Set<string>>(new Set());
  const [completingAll, setCompletingAll] = useState(false);

  // Plain text view state (for approved items)
  const [plainTextView, setPlainTextView] = useState<Set<string>>(new Set());

  // Texter notes state (per item)
  const [texterNotes, setTexterNotes] = useState<Map<string, string>>(() => {
    const map = new Map<string, string>();
    texterstellung.items.forEach(item => {
      if (item.texterNote) {
        map.set(item.id, item.texterNote);
      }
    });
    return map;
  });
  const [savingTexterNote, setSavingTexterNote] = useState<Set<string>>(new Set());

  // Messages
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const activeItem = sortedItems.find(i => i.id === activeItemId);

  const startEditing = (itemId: string, currentContent: string) => {
    const newMap = new Map(editingItems);
    newMap.set(itemId, currentContent);
    setEditingItems(newMap);
  };

  const cancelEditing = (itemId: string) => {
    const newMap = new Map(editingItems);
    newMap.delete(itemId);
    setEditingItems(newMap);
  };

  const updateEditContent = (itemId: string, content: string) => {
    const newMap = new Map(editingItems);
    newMap.set(itemId, content);
    setEditingItems(newMap);
  };

  const handleSaveDraft = async (itemId: string) => {
    const content = editingItems.get(itemId);
    if (!content) return;

    setSavingItems((prev) => new Set(prev).add(itemId));
    try {
      await saveTextDraft(itemId, content, projectId);
      cancelEditing(itemId);
    } catch (error) {
      console.error("Fehler beim Speichern:", error);
      alert("Fehler beim Speichern");
    } finally {
      setSavingItems((prev) => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    }
  };

  const handleMarkAsComplete = async (itemId: string) => {
    setCompletingItems((prev) => new Set(prev).add(itemId));
    try {
      await markTextAsComplete(itemId, projectId);
    } catch (error) {
      console.error("Fehler beim Abschließen:", error);
      alert("Fehler beim Abschließen des Textes");
    } finally {
      setCompletingItems((prev) => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    }
  };

  const handleMarkAsIncomplete = async (itemId: string) => {
    setCompletingItems((prev) => new Set(prev).add(itemId));
    try {
      await markTextAsIncomplete(itemId, projectId);
    } catch (error) {
      console.error("Fehler beim Zurücksetzen:", error);
      alert("Fehler beim Zurücksetzen des Textes");
    } finally {
      setCompletingItems((prev) => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    }
  };

  const handleMarkAllAsComplete = async () => {
    setCompletingAll(true);
    setSuccessMessage(null);
    setErrorMessage(null);
    try {
      const result = await markAllTextsAsComplete(texterstellung.id, projectId);
      setSuccessMessage(`${result.count} ${result.count === 1 ? "Text wurde" : "Texte wurden"} als fertig markiert.`);
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (error) {
      console.error("Fehler beim Abschließen:", error);
      setErrorMessage("Fehler beim Abschließen der Texte. Bitte versuchen Sie es erneut.");
      setTimeout(() => setErrorMessage(null), 5000);
    } finally {
      setCompletingAll(false);
    }
  };

  const handleSaveTexterNote = async (itemId: string) => {
    const note = texterNotes.get(itemId) || "";
    setSavingTexterNote((prev) => new Set(prev).add(itemId));
    try {
      await updateTexterNote(itemId, note, projectId);
    } catch (error) {
      console.error("Fehler beim Speichern der Notiz:", error);
    } finally {
      setSavingTexterNote((prev) => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
            Ausstehend
          </span>
        );
      case "DRAFT":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
            Entwurf
          </span>
        );
      case "APPROVED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Fertig
          </span>
        );
      default:
        return null;
    }
  };

  const fmtDateTime = (d?: Date | string | null) => {
    if (!d) return "-";
    try {
      const dateStr = typeof d === "string" ? d : d.toISOString();
      const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
      if (!match) return "-";
      const [, year, month, day, hours, minutes] = match;
      return `${day}.${month}.${year}, ${hours}:${minutes} Uhr`;
    } catch {
      return "-";
    }
  };

  const fmtDate = (d?: Date | string | null) => {
    if (!d) return "-";
    try {
      const dateStr = typeof d === "string" ? d : d.toISOString();
      const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (!match) return "-";
      const [, year, month, day] = match;
      return `${day}.${month}.${year}`;
    } catch {
      return "-";
    }
  };

  // Strip HTML tags for plain text view
  const stripHtml = (html: string) => {
    return html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<\/li>/gi, "\n")
      .replace(/<li>/gi, "• ")
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  };

  const togglePlainTextView = (itemId: string) => {
    const newSet = new Set(plainTextView);
    if (newSet.has(itemId)) {
      newSet.delete(itemId);
    } else {
      newSet.add(itemId);
    }
    setPlainTextView(newSet);
  };

  // Items that can be marked as complete (have draft content)
  const draftItems = sortedItems.filter(
    (item) => item.status === "DRAFT" && item.versions.length > 0
  );

  if (sortedItems.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
        <p className="text-gray-500 dark:text-gray-400">
          Keine Texte in der Texterstellung vorhanden.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl p-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm font-medium text-green-800 dark:text-green-200 flex-1">{successMessage}</p>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl p-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="text-sm font-medium text-red-800 dark:text-red-200 flex-1">{errorMessage}</p>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Bulk Actions */}
      {canEdit && draftItems.length > 0 && (
        <div className="bg-cyan-50 dark:bg-cyan-900/20 rounded-xl border border-cyan-200 dark:border-cyan-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-cyan-900 dark:text-cyan-200">
                {draftItems.length} Text{draftItems.length !== 1 ? "e" : ""} bereit zum Abschließen
              </h3>
              <p className="text-sm text-cyan-700 dark:text-cyan-400">
                Alle fertigen Texte auf einmal als fertig markieren
              </p>
            </div>
            <button
              onClick={handleMarkAllAsComplete}
              disabled={completingAll}
              className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              {completingAll ? "Wird abgeschlossen..." : "Alle als fertig markieren"}
            </button>
          </div>
        </div>
      )}

      {/* Main Layout: Tabs + Content */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Tab Navigation */}
        <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <div className="flex overflow-x-auto scrollbar-thin">
            {sortedItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveItemId(item.id)}
                className={`flex-shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeItemId === item.id
                    ? "border-cyan-500 text-cyan-600 dark:text-cyan-400 bg-white dark:bg-gray-800"
                    : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"
                }`}
              >
                <span className="flex items-center gap-2">
                  {item.menuItemName}
                  {getStatusBadge(item.status)}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Active Item Content */}
        {activeItem && (
          <div className="p-6">
            {(() => {
              const isEditing = editingItems.has(activeItem.id);
              const editContent = editingItems.get(activeItem.id) || "";
              const isSaving = savingItems.has(activeItem.id);
              const isCompleting = completingItems.has(activeItem.id);
              const latestVersion = activeItem.versions[0];
              const texterNote = texterNotes.get(activeItem.id) || "";
              const isSavingNote = savingTexterNote.has(activeItem.id);

              return (
                <div className="space-y-6">
                  {/* Menu Item Notes (Hinweise zum Menüpunkt) - from WebDoku */}
                  {menuItemNotes[activeItem.menuItemId] && (
                    <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400 mb-2">
                        Hinweise zum Menüpunkt
                      </h4>
                      <p className="text-sm text-amber-800 dark:text-amber-300">
                        {menuItemNotes[activeItem.menuItemId]}
                      </p>
                    </div>
                  )}

                  {/* Two Column Layout: Stichpunkte (40%) + Text (60%) */}
                  <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    {/* Left: Stichpunkte vom Kunden (2/5 = 40%) */}
                    <div className="lg:col-span-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
                        Stichpunkte vom Kunden
                      </h4>
                      <div
                        className="prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/30 p-4 rounded-lg border border-gray-200 dark:border-gray-600"
                        dangerouslySetInnerHTML={{ __html: activeItem.bulletPoints }}
                      />
                    </div>

                    {/* Right: Erstellter Text (3/5 = 60%) */}
                    <div className="lg:col-span-3">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                          Erstellter Text
                          {latestVersion && (
                            <span className="ml-2 text-gray-400 dark:text-gray-500 font-normal">
                              (Version {latestVersion.versionNumber})
                            </span>
                          )}
                        </h4>
                        {canEdit && activeItem.status !== "APPROVED" && !isEditing && (
                          <button
                            onClick={() => startEditing(activeItem.id, latestVersion?.content || "")}
                            className="text-xs text-cyan-600 hover:text-cyan-800 dark:text-cyan-400 dark:hover:text-cyan-300"
                          >
                            {latestVersion ? "Bearbeiten" : "Text erstellen"}
                          </button>
                        )}
                        {activeItem.status === "APPROVED" && latestVersion && (
                          <button
                            onClick={() => togglePlainTextView(activeItem.id)}
                            className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 flex items-center gap-1"
                          >
                            {plainTextView.has(activeItem.id) ? (
                              <>
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                                </svg>
                                HTML anzeigen
                              </>
                            ) : (
                              <>
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                                </svg>
                                Nur Text
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      {isEditing ? (
                        <div className="space-y-3">
                          <RichTextEditor
                            content={editContent}
                            onChange={(html) => updateEditContent(activeItem.id, html)}
                            placeholder="Text hier eingeben..."
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSaveDraft(activeItem.id)}
                              disabled={isSaving}
                              className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                            >
                              {isSaving ? "Speichern..." : "Speichern"}
                            </button>
                            <button
                              onClick={() => cancelEditing(activeItem.id)}
                              disabled={isSaving}
                              className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                            >
                              Abbrechen
                            </button>
                          </div>
                        </div>
                      ) : latestVersion ? (
                        activeItem.status === "APPROVED" && plainTextView.has(activeItem.id) ? (
                          <pre className="text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700/50 p-4 rounded-lg border border-gray-200 dark:border-gray-600 whitespace-pre-wrap font-sans">
                            {stripHtml(latestVersion.content)}
                          </pre>
                        ) : (
                          <div
                            className="prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700/50 p-4 rounded-lg border border-gray-200 dark:border-gray-600"
                            dangerouslySetInnerHTML={{ __html: latestVersion.content }}
                          />
                        )
                      ) : (
                        <div className="p-4 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-200 dark:border-gray-600 text-center">
                          <p className="text-sm text-gray-400 dark:text-gray-500 italic">
                            Noch kein Text erstellt
                          </p>
                          {canEdit && (
                            <button
                              onClick={() => startEditing(activeItem.id, "")}
                              className="mt-2 text-sm text-cyan-600 hover:text-cyan-800 dark:text-cyan-400 dark:hover:text-cyan-300"
                            >
                              Jetzt Text erstellen
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Info vom Texter */}
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Info vom Texter
                      </h4>
                      {canEdit && (
                        <button
                          onClick={() => handleSaveTexterNote(activeItem.id)}
                          disabled={isSavingNote}
                          className="text-xs text-cyan-600 hover:text-cyan-800 dark:text-cyan-400 dark:hover:text-cyan-300 disabled:opacity-50"
                        >
                          {isSavingNote ? "Speichern..." : "Speichern"}
                        </button>
                      )}
                    </div>
                    {canEdit ? (
                      <textarea
                        value={texterNote}
                        onChange={(e) => {
                          const newNotes = new Map(texterNotes);
                          newNotes.set(activeItem.id, e.target.value);
                          setTexterNotes(newNotes);
                        }}
                        placeholder="Notizen zum Text (z.B. offene Fragen, Anmerkungen für Kollegen)..."
                        className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none"
                        rows={2}
                      />
                    ) : texterNote ? (
                      <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/30 p-3 rounded-lg border border-gray-200 dark:border-gray-600">
                        {texterNote}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-400 dark:text-gray-500 italic">
                        Keine Notizen vorhanden
                      </p>
                    )}
                  </div>

                  {/* Status / Actions */}
                  {activeItem.status === "APPROVED" && latestVersion && (
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span className="font-medium">Text fertiggestellt</span>
                          </div>
                          <p className="text-xs text-green-600 dark:text-green-500 mt-1 ml-7">
                            von {latestVersion.createdByName || "Unbekannt"} am {fmtDate(latestVersion.createdAt)}
                          </p>
                        </div>
                        {canEdit && (
                          <button
                            onClick={() => handleMarkAsIncomplete(activeItem.id)}
                            disabled={isCompleting}
                            className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 underline disabled:opacity-50"
                          >
                            {isCompleting ? "Wird zurückgesetzt..." : "Zurück zu Entwurf"}
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {canEdit && activeItem.status === "DRAFT" && latestVersion && !isEditing && (
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => handleMarkAsComplete(activeItem.id)}
                        disabled={isCompleting}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {isCompleting ? "Wird abgeschlossen..." : "Als fertig markieren"}
                      </button>
                    </div>
                  )}

                  {/* Version History */}
                  {activeItem.versions.length > 1 && (
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
                        Versions-Historie
                      </h4>
                      <div className="space-y-1">
                        {activeItem.versions.slice(1).map((version) => (
                          <div
                            key={version.id}
                            className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2"
                          >
                            <span className="font-medium">V{version.versionNumber}</span>
                            <span>•</span>
                            <span>{fmtDateTime(version.createdAt)}</span>
                            {version.createdByName && (
                              <>
                                <span>•</span>
                                <span>{version.createdByName}</span>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
