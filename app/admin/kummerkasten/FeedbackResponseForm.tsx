"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { updateFeedbackResponse } from "./actions";

type Props = {
  feedbackId: string;
  initialResponse?: string | null;
};

export function FeedbackResponseForm({ feedbackId, initialResponse }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [response, setResponse] = useState(initialResponse || "");

  const handleSubmit = async (formData: FormData) => {
    await updateFeedbackResponse(formData);
    setIsEditing(false);
  };

  if (!isEditing && !initialResponse) {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setIsEditing(true)}
      >
        Antworten
      </Button>
    );
  }

  if (!isEditing && initialResponse) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-green-700">Admin-Antwort:</span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setIsEditing(true)}
            className="h-6 px-2 text-xs"
          >
            Bearbeiten
          </Button>
        </div>
        <p className="whitespace-pre-wrap text-sm text-gray-700 bg-green-50 border border-green-200 rounded p-3">
          {initialResponse}
        </p>
      </div>
    );
  }

  return (
    <form action={handleSubmit} className="space-y-3">
      <input type="hidden" name="id" value={feedbackId} />
      <div className="space-y-1">
        <label htmlFor={`response-${feedbackId}`} className="text-xs font-semibold text-green-700">
          Admin-Antwort:
        </label>
        <Textarea
          id={`response-${feedbackId}`}
          name="response"
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          placeholder="Deine Antwort an den Autor..."
          className="min-h-[100px] text-sm"
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm">
          Speichern
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            setResponse(initialResponse || "");
            setIsEditing(false);
          }}
        >
          Abbrechen
        </Button>
      </div>
    </form>
  );
}
