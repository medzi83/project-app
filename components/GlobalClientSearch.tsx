"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, User } from "lucide-react";

type Client = {
  id: string;
  name: string;
  customerNo: string | null;
  contact: string | null;
  email: string | null;
  phone: string | null;
};

export function GlobalClientSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Load clients when search is opened
  useEffect(() => {
    if (isOpen && clients.length === 0) {
      loadClients();
    }
  }, [isOpen]);

  // Filter clients based on search term (including contact information)
  useEffect(() => {
    if (searchTerm.trim() === "") {
      setFilteredClients([]);
      return;
    }

    const searchLower = searchTerm.toLowerCase();
    const filtered = clients.filter((client) => {
      return (
        client.name.toLowerCase().includes(searchLower) ||
        (client.customerNo && client.customerNo.toLowerCase().includes(searchLower)) ||
        (client.contact && client.contact.toLowerCase().includes(searchLower)) ||
        (client.email && client.email.toLowerCase().includes(searchLower)) ||
        (client.phone && client.phone.toLowerCase().includes(searchLower))
      );
    });

    setFilteredClients(filtered.slice(0, 10)); // Limit to 10 results
    setSelectedIndex(0);
  }, [searchTerm, clients]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K or Ctrl+K to open search
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => inputRef.current?.focus(), 100);
      }

      // Escape to close
      if (e.key === "Escape") {
        setIsOpen(false);
        setSearchTerm("");
      }

      // Arrow keys to navigate
      if (isOpen && filteredClients.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % filteredClients.length);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + filteredClients.length) % filteredClients.length);
        } else if (e.key === "Enter") {
          e.preventDefault();
          if (filteredClients[selectedIndex]) {
            navigateToClient(filteredClients[selectedIndex].id);
          }
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, filteredClients, selectedIndex]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearchTerm("");
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const loadClients = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/clients?minimal=true");
      if (res.ok) {
        const data = await res.json();
        setClients(data);
      }
    } catch (error) {
      console.error("Failed to load clients:", error);
    } finally {
      setLoading(false);
    }
  };

  const navigateToClient = (clientId: string) => {
    router.push(`/clients/${clientId}`);
    setIsOpen(false);
    setSearchTerm("");
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Search Button */}
      <button
        onClick={() => {
          setIsOpen(true);
          setTimeout(() => inputRef.current?.focus(), 100);
        }}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 rounded-lg shadow-md hover:shadow-lg transition-all"
      >
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">Kunde suchen</span>
        <kbd className="hidden md:inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-mono bg-white/20 border border-white/30 rounded text-white">
          <span className="text-[10px]">⌘</span>K
        </kbd>
      </button>

      {/* Search Dropdown */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-96 max-w-[calc(100vw-2rem)] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-2xl z-50">
          {/* Search Input */}
          <div className="p-3 border-b border-gray-200 dark:border-gray-700">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
              <input
                ref={inputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Kunde, Kundennummer oder Kontaktperson..."
                className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 placeholder:text-gray-500 dark:placeholder:text-gray-400"
              />
            </div>
          </div>

          {/* Results */}
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
                Lade Kunden...
              </div>
            ) : searchTerm.trim() === "" ? (
              <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
                Geben Sie einen Suchbegriff ein...
              </div>
            ) : filteredClients.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
                Keine Ergebnisse gefunden
              </div>
            ) : (
              <div className="py-1">
                {filteredClients.map((client, index) => (
                  <button
                    key={client.id}
                    onClick={() => navigateToClient(client.id)}
                    className={`w-full text-left px-4 py-3 hover:bg-blue-50 dark:hover:bg-gray-700 transition border-b border-gray-100 dark:border-gray-700 last:border-b-0 ${
                      index === selectedIndex ? "bg-blue-50 dark:bg-gray-700" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                        <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-gray-900 dark:text-white truncate">
                          {client.name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
                          {client.customerNo && (
                            <div>Kunden-Nr: {client.customerNo}</div>
                          )}
                          {client.contact && (
                            <div>Kontakt: {client.contact}</div>
                          )}
                          {client.email && (
                            <div>{client.email}</div>
                          )}
                          {client.phone && (
                            <div>{client.phone}</div>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-gray-400 dark:text-gray-500">→</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {filteredClients.length > 0 && (
            <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 flex items-center justify-between">
              <span>↑↓ zum Navigieren</span>
              <span>↵ zum Öffnen</span>
              <span>ESC zum Schließen</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
