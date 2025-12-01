'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  Search,
  User,
  X,
  Cloud,
  Building2,
  Loader2,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LuckyCloudClientCard, type LuckyCloudClientData } from '@/components/LuckyCloudClientCard';

type Agency = 'eventomaxx' | 'vendoweb';

type Client = LuckyCloudClientData & {
  agencyId: string | null;
};

type LuckyCloudClientAssignmentProps = {
  /** Konfigurierte Agenturen (für Fehlermeldung wenn Agentur nicht konfiguriert) */
  configuredAgencies?: Agency[];
};

export function LuckyCloudClientAssignment({
  configuredAgencies = ['eventomaxx', 'vendoweb'],
}: LuckyCloudClientAssignmentProps) {
  // Kundensuche State
  const [searchTerm, setSearchTerm] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Kundensuche
  const searchClients = useCallback(async (term: string) => {
    if (term.length < 2) {
      setClients([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`/api/admin/luckycloud/clients?search=${encodeURIComponent(term)}`);
      const data = await response.json();
      if (data.clients) {
        setClients(data.clients);
      }
    } catch (error) {
      console.error('Error searching clients:', error);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchClients(searchTerm);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchTerm, searchClients]);

  // Kunde auswählen
  const selectClient = (client: Client) => {
    setSelectedClient(client);
    setSearchTerm('');
    setClients([]);
  };

  // Callback wenn sich die Zuordnung ändert
  const handleAssignmentChange = (data: {
    luckyCloudLibraryId: string | null;
    luckyCloudLibraryName: string | null;
    luckyCloudFolderPath: string | null;
  }) => {
    if (selectedClient) {
      setSelectedClient({
        ...selectedClient,
        ...data,
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Kundensuche */}
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Kunde suchen (Name oder Kundennummer)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
          {isSearching && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>

        {/* Suchergebnisse */}
        {clients.length > 0 && (
          <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover p-1 shadow-md">
            {clients.map((client) => (
              <button
                key={client.id}
                onClick={() => selectClient(client)}
                className="flex w-full items-center gap-3 rounded-sm px-3 py-2 text-left text-sm hover:bg-accent"
              >
                <User className="h-4 w-4 text-muted-foreground" />
                <div className="flex-1 truncate">
                  <span className="font-medium">{client.name}</span>
                  {client.customerNo && (
                    <span className="ml-2 text-muted-foreground">({client.customerNo})</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {client.agency && (
                    <Badge variant="outline" className="text-xs">
                      {client.agency.name}
                    </Badge>
                  )}
                  {client.luckyCloudLibraryId && (
                    <Badge variant="secondary" className="text-xs">
                      <Cloud className="h-3 w-3 mr-1" />
                      Zugeordnet
                    </Badge>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Ausgewählter Kunde */}
      {selectedClient && (
        <div className="rounded-lg border bg-muted/50 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="font-medium">{selectedClient.name}</div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {selectedClient.customerNo && (
                    <span>Kundennummer: {selectedClient.customerNo}</span>
                  )}
                  {selectedClient.agency && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {selectedClient.agency.name}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedClient(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* LuckyCloud Card (zentrale Komponente) */}
          <LuckyCloudClientCard
            client={selectedClient}
            onAssignmentChange={handleAssignmentChange}
            canEdit={true}
            compact={true}
          />
        </div>
      )}
    </div>
  );
}
