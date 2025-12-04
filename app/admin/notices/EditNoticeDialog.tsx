"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { updateNotice, updateCustomerNotice } from "@/app/notices/actions";

type Agent = {
  id: string;
  name: string | null;
  email: string | null;
};

type NoticeRecipient = {
  userId: string;
  user: { id: string; name: string | null; email: string | null };
};

type AgentNotice = {
  id: string;
  title: string;
  message: string;
  visibility: "GLOBAL" | "TARGETED";
  requireAcknowledgement: boolean;
  isActive: boolean;
  recipients: NoticeRecipient[];
};

type Agency = {
  id: string;
  name: string;
};

type Client = {
  id: string;
  name: string;
  customerNo: string | null;
  agency: { name: string } | null;
};

type CustomerNoticeRecipient = {
  clientId: string;
  client: { id: string; name: string; customerNo: string | null };
};

type CustomerNotice = {
  id: string;
  title: string;
  message: string;
  targetGroup: "ALL_CUSTOMERS" | "AGENCY_CUSTOMERS" | "SELECTED_CUSTOMERS";
  agencyId: string | null;
  showOnDashboard: boolean;
  isActive: boolean;
  recipients: CustomerNoticeRecipient[];
};

// ========================================
// AGENTEN-HINWEIS BEARBEITEN
// ========================================

export function EditAgentNoticeDialog({
  notice,
  agents,
}: {
  notice: AgentNotice;
  agents: Agent[];
}) {
  const [open, setOpen] = useState(false);

  const handleSubmit = async (formData: FormData) => {
    await updateNotice(formData);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Bearbeiten
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Agenten-Hinweis bearbeiten</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-6">
          <input type="hidden" name="noticeId" value={notice.id} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Titel</label>
              <Input name="title" defaultValue={notice.title} required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Sichtbarkeit</label>
              <div className="flex gap-3 rounded-lg border border-border bg-background p-3 text-sm text-foreground">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="visibility"
                    value="GLOBAL"
                    defaultChecked={notice.visibility === "GLOBAL"}
                  />
                  Global
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="visibility"
                    value="TARGETED"
                    defaultChecked={notice.visibility === "TARGETED"}
                  />
                  Bestimmte Agenten
                </label>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Nachricht</label>
            <Textarea
              name="message"
              rows={5}
              required
              defaultValue={notice.message}
              className="resize-y"
            />
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground">Empfänger (Agenten)</label>
            <select
              name="recipients"
              multiple
              className="w-full rounded-lg border border-border bg-background p-2 text-sm text-foreground"
              size={Math.min(agents.length, 8)}
              defaultValue={notice.recipients.map((r) => r.userId)}
            >
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name ?? agent.email ?? agent.id}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Für globale Hinweise wird die Auswahl ignoriert.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <input
                type="checkbox"
                name="requireAcknowledgement"
                defaultChecked={notice.requireAcknowledgement}
                className="h-4 w-4 rounded border-gray-300 dark:border-gray-600"
              />
              Bestätigung durch Agenten erforderlich
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={notice.isActive}
                className="h-4 w-4 rounded border-gray-300 dark:border-gray-600"
              />
              Im Dashboard anzeigen
            </label>
          </div>

          <div className="flex gap-3">
            <Button type="submit">Speichern</Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ========================================
// KUNDEN-HINWEIS BEARBEITEN
// ========================================

export function EditCustomerNoticeDialog({
  notice,
  agencies,
  clients,
}: {
  notice: CustomerNotice;
  agencies: Agency[];
  clients: Client[];
}) {
  const [open, setOpen] = useState(false);

  const handleSubmit = async (formData: FormData) => {
    await updateCustomerNotice(formData);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Bearbeiten
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Kunden-Hinweis bearbeiten</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-6">
          <input type="hidden" name="noticeId" value={notice.id} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Titel</label>
              <Input name="title" defaultValue={notice.title} required />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Zielgruppe</label>
              <div className="flex flex-col gap-2 rounded-lg border border-border bg-background p-3 text-sm text-foreground">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="targetGroup"
                    value="ALL_CUSTOMERS"
                    defaultChecked={notice.targetGroup === "ALL_CUSTOMERS"}
                  />
                  Alle Kunden
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="targetGroup"
                    value="AGENCY_CUSTOMERS"
                    defaultChecked={notice.targetGroup === "AGENCY_CUSTOMERS"}
                  />
                  Nur Kunden einer Agentur
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="targetGroup"
                    value="SELECTED_CUSTOMERS"
                    defaultChecked={notice.targetGroup === "SELECTED_CUSTOMERS"}
                  />
                  Ausgewählte Kunden
                </label>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Nachricht</label>
            <Textarea
              name="message"
              rows={5}
              required
              defaultValue={notice.message}
              className="resize-y"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">
                Agentur <span className="text-xs text-muted-foreground">(für Agentur-Kunden)</span>
              </label>
              <select
                name="agencyId"
                className="w-full rounded-lg border border-border bg-background p-2 text-sm text-foreground"
                defaultValue={notice.agencyId ?? ""}
              >
                <option value="">-- Agentur auswählen --</option>
                {agencies.map((agency) => (
                  <option key={agency.id} value={agency.id}>
                    {agency.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium text-foreground">
                Kunden <span className="text-xs text-muted-foreground">(für ausgewählte Kunden)</span>
              </label>
              <select
                name="recipients"
                multiple
                className="w-full rounded-lg border border-border bg-background p-2 text-sm text-foreground"
                size={Math.min(clients.length, 8)}
                defaultValue={notice.recipients.map((r) => r.clientId)}
              >
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                    {client.customerNo ? ` (${client.customerNo})` : ""}
                    {client.agency?.name ? ` - ${client.agency.name}` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <input
                type="checkbox"
                name="showOnDashboard"
                defaultChecked={notice.showOnDashboard}
                className="h-4 w-4 rounded border-gray-300 dark:border-gray-600"
              />
              Auch auf Dashboard anzeigen (wichtig)
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={notice.isActive}
                className="h-4 w-4 rounded border-gray-300 dark:border-gray-600"
              />
              Im Kundenportal anzeigen
            </label>
          </div>

          <div className="flex gap-3">
            <Button type="submit">Speichern</Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Abbrechen
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
