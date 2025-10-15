"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type EmailLogDialogProps = {
  subject: string;
  body: string;
  toEmail: string;
  ccEmails?: string | null;
  sentAt: Date | string;
  trigger?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function EmailLogDialog({
  subject,
  body,
  toEmail,
  ccEmails,
  sentAt,
  trigger,
  open,
  onOpenChange,
}: EmailLogDialogProps) {
  const formatDate = (value: Date | string) => {
    try {
      return new Intl.DateTimeFormat("de-DE", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value));
    } catch {
      return "-";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{subject}</DialogTitle>
          <DialogDescription>
            E-Mail Details
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {/* Metadata */}
          <div className="rounded-lg border bg-gray-50 p-4 space-y-2 text-sm">
            <div>
              <span className="font-medium text-gray-700">An:</span>{" "}
              <span className="text-gray-900">{toEmail}</span>
            </div>
            {ccEmails && (
              <div>
                <span className="font-medium text-gray-700">CC:</span>{" "}
                <span className="text-gray-900">{ccEmails}</span>
              </div>
            )}
            {trigger && (
              <div>
                <span className="font-medium text-gray-700">Trigger:</span>{" "}
                <span className="text-gray-900">{trigger}</span>
              </div>
            )}
            <div>
              <span className="font-medium text-gray-700">Gesendet:</span>{" "}
              <span className="text-gray-900">{formatDate(sentAt)}</span>
            </div>
          </div>

          {/* Email Body */}
          <div>
            <h3 className="font-medium text-sm text-gray-700 mb-2">Nachricht:</h3>
            <div
              className="rounded-lg border bg-white p-4 prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: body }}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
