export const DEFAULT_SIGNATURE_KEY = "default";

export const EMAIL_TEMPLATE_CATEGORIES = {
  GENERAL: { value: "GENERAL", label: "Allgemein" },
  WEBSITE: { value: "WEBSITE", label: "Webseite" },
  FILM: { value: "FILM", label: "Film" },
  SOCIAL_MEDIA: { value: "SOCIAL_MEDIA", label: "Social Media" },
} as const;

export type EmailTemplateCategoryKey = keyof typeof EMAIL_TEMPLATE_CATEGORIES;
