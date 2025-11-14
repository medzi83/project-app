'use client';

import { useState } from "react";
import { deleteEmailTemplate } from "./actions";
import ConfirmSubmit from "@/components/ConfirmSubmit";
import TemplateSlideout from "./TemplateSlideout";
import EditTemplateForm from "./EditTemplateForm";
import type { VariableGroup } from "./VariableGroupsPanel";
import { EMAIL_TEMPLATE_CATEGORIES, type EmailTemplateCategoryKey } from "./constants";

const fmtDate = (value: Date) =>
  new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(value);

type Props = {
  templates: Array<{
    id: string;
    title: string;
    subject: string;
    body: string;
    category: string;
    updatedAt: Date;
  }>;
  variableGroups: VariableGroup[];
  agencies: Array<{ id: string; name: string }>;
};

export default function TemplatesByCategory({ templates, variableGroups, agencies }: Props) {
  // Group templates by category
  const templatesByCategory = Object.entries(EMAIL_TEMPLATE_CATEGORIES).map(([key, { label }]) => {
    const categoryTemplates = templates.filter((t) => t.category === key);
    return {
      key: key as EmailTemplateCategoryKey,
      label,
      templates: categoryTemplates,
      count: categoryTemplates.length,
    };
  });

  // Set first category with templates as default, or GENERAL
  const defaultCategory = templatesByCategory.find((cat) => cat.count > 0)?.key || "GENERAL";
  const [activeCategory, setActiveCategory] = useState<EmailTemplateCategoryKey>(defaultCategory);

  const activeCategoryData = templatesByCategory.find((cat) => cat.key === activeCategory);

  return (
    <div className="space-y-4">
      {/* Category Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8" aria-label="Kategorien">
          {templatesByCategory.map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setActiveCategory(key)}
              className={`group inline-flex items-center border-b-2 px-1 py-4 text-sm font-medium transition-colors ${
                activeCategory === key
                  ? "border-blue-600 dark:border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-muted-foreground hover:border-gray-300 dark:hover:border-gray-600 hover:text-foreground"
              }`}
            >
              <span>{label}</span>
              <span
                className={`ml-2 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  activeCategory === key
                    ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 group-hover:bg-gray-200 dark:group-hover:bg-gray-700"
                }`}
              >
                {count}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Active Category Content */}
      {activeCategoryData && (
        <div>
          {activeCategoryData.templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine Vorlagen in dieser Kategorie.</p>
          ) : (
            <div className="space-y-3">
              {activeCategoryData.templates.map((template) => (
                <TemplateSlideout
                  key={template.id}
                  title={template.title}
                  subtitle={template.subject}
                  meta={`Stand ${fmtDate(template.updatedAt)}`}
                >
                  <EditTemplateForm
                    id={template.id}
                    initialTitle={template.title}
                    initialSubject={template.subject}
                    initialBody={template.body}
                    initialCategory={template.category as EmailTemplateCategoryKey}
                    variableGroups={variableGroups}
                    agencies={agencies}
                  />

                  <form action={deleteEmailTemplate} className="mt-6 border-t dark:border-gray-700 pt-6">
                    <input type="hidden" name="id" value={template.id} />
                    <ConfirmSubmit
                      confirmText="Diese Vorlage wirklich löschen? Dies kann nicht rückgängig gemacht werden."
                      className="rounded border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/30 px-3 py-1.5 text-sm font-medium text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40"
                    >
                      Vorlage löschen
                    </ConfirmSubmit>
                  </form>
                </TemplateSlideout>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
