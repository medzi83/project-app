'use client';

import { useState } from "react";

type Agency = {
  id: string;
  name: string;
};

type SendTestEmailFormProps = {
  templateId: string;
  agencies: Agency[];
};

export default function SendTestEmailForm({ templateId, agencies }: SendTestEmailFormProps) {
  const [email, setEmail] = useState("");
  const [agencyId, setAgencyId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !agencyId) {
      setMessage({ type: 'error', text: 'Bitte E-Mail und Agentur auswählen' });
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/email-templates/send-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId, email, agencyId }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: 'Test-E-Mail erfolgreich versendet!' });
        setEmail("");
      } else {
        setMessage({ type: 'error', text: data.error || 'Fehler beim Versenden' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Netzwerkfehler beim Versenden' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <h4 className="text-sm font-semibold mb-3">Test-E-Mail versenden</h4>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label htmlFor="testEmail" className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
            Empfänger E-Mail *
          </label>
          <input
            id="testEmail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="test@example.com"
            required
            className="w-full rounded border px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label htmlFor="testAgency" className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
            Agentur *
          </label>
          <select
            id="testAgency"
            value={agencyId}
            onChange={(e) => setAgencyId(e.target.value)}
            required
            className="w-full rounded border px-3 py-2 text-sm"
          >
            <option value="">Agentur auswählen...</option>
            {agencies.map((agency) => (
              <option key={agency.id} value={agency.id}>
                {agency.name}
              </option>
            ))}
          </select>
        </div>

        {message && (
          <div
            className={`rounded-lg border-2 p-3 text-sm font-medium ${
              message.type === 'success'
                ? 'border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 text-green-700'
                : 'border-red-200 bg-gradient-to-r from-red-50 to-pink-50 text-red-700'
            }`}
          >
            {message.text}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="rounded border border-blue-600 bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Wird gesendet...' : 'Test-E-Mail senden'}
        </button>
      </form>
    </div>
  );
}
