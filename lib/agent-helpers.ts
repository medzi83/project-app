/**
 * Helper functions for managing Web-Agents and their WT (Webtermin) aliases.
 *
 * WT = "Webtermin" - Bezeichnet einen Agenten, der nur für den initialen Webtermin zuständig ist,
 * aber nicht zwingend das spätere Projekt umsetzt.
 *
 * Beispiel:
 * - "Nico" = Macht das komplette Website-Projekt (Umsetzung, Demo, Online)
 * - "Nico WT" = Macht nur den Webtermin (Beratungsgespräch), Projekt kann später an anderen Agenten gehen
 *
 * Wichtig: Dies sind KEINE separaten Agenten, sondern Aliases die auf denselben Base-Agent verweisen.
 * Der Unterschied wird über das `isWTAssignment` Flag in ProjectWebsite gespeichert.
 */

export type AgentWithAlias = {
  id: string;
  name: string | null;
  email: string | null;
  color: string | null;
  categories: string[];
  isWTAlias?: boolean;
  baseAgentId?: string;
  baseAgentName?: string | null;
};

/**
 * Generiert eine WT-Alias-ID aus einer Base-Agent-ID
 * @param baseAgentId - Die ID des Basis-Agenten
 * @returns Agent-ID mit "_WT" Suffix (z.B. "abc123_WT")
 */
export function getWTAliasId(baseAgentId: string): string {
  return `${baseAgentId}_WT`;
}

/**
 * Generiert einen WT-Alias-Namen aus einem Base-Agent-Namen
 * @param baseAgentName - Der Name des Basis-Agenten
 * @returns Agent-Name mit " WT" Suffix (z.B. "Nico WT")
 */
export function getWTAliasName(baseAgentName: string | null): string {
  if (!baseAgentName) return "WT";
  return `${baseAgentName} WT`;
}

/**
 * Prüft ob eine Agent-ID ein WT-Alias ist
 * @param agentId - Die zu prüfende Agent-ID
 * @returns true wenn ID mit "_WT" endet
 */
export function isWTAliasId(agentId: string): boolean {
  return agentId.endsWith("_WT");
}

/**
 * Extrahiert die Basis-Agent-ID aus einer WT-Alias-ID
 * @param agentId - Die Agent-ID (mit oder ohne "_WT" Suffix)
 * @returns Die Basis-Agent-ID (ohne "_WT" Suffix)
 */
export function getBaseAgentId(agentId: string): string {
  if (isWTAliasId(agentId)) {
    return agentId.slice(0, -3); // Remove "_WT" suffix
  }
  return agentId;
}

/**
 * Erweitert eine Agenten-Liste um WT-Aliases für Website-Projekte
 *
 * Für jeden Agenten mit WEBSEITE-Kategorie wird ein zusätzlicher WT-Alias erstellt.
 * Beispiel: "Nico" → wird zu ["Nico", "Nico WT"]
 *
 * @param agents - Liste der Basis-Agenten
 * @returns Erweiterte Liste mit Basis-Agenten + WT-Aliases
 */
export function expandAgentsWithWTAliases(
  agents: Array<{
    id: string;
    name: string | null;
    email: string | null;
    color?: string | null;
    categories: string[];
  }>
): AgentWithAlias[] {
  const expanded: AgentWithAlias[] = [];

  for (const agent of agents) {
    // Add the base agent
    expanded.push({
      id: agent.id,
      name: agent.name,
      email: agent.email,
      color: agent.color ?? null,
      categories: agent.categories,
    });

    // Add WT alias if agent has WEBSEITE category
    if (agent.categories.includes("WEBSEITE")) {
      expanded.push({
        id: getWTAliasId(agent.id),
        name: getWTAliasName(agent.name),
        email: agent.email,
        color: agent.color ?? null,
        categories: agent.categories,
        isWTAlias: true,
        baseAgentId: agent.id,
        baseAgentName: agent.name,
      });
    }
  }

  return expanded;
}

/**
 * Konvertiert eine potenzielle WT-Alias-ID zurück zur Basis-Agent-ID und isWTAssignment-Flag für DB-Queries
 *
 * Diese Funktion wird verwendet, wenn ein Agent aus einem Dropdown ausgewählt wird.
 * - Normale Agent-ID: "abc123" → { baseAgentId: "abc123", isWTAssignment: false }
 * - WT-Alias-ID: "abc123_WT" → { baseAgentId: "abc123", isWTAssignment: true }
 *
 * Das isWTAssignment-Flag wird in ProjectWebsite.isWTAssignment gespeichert und zeigt an,
 * dass dieser Agent nur für den Webtermin zuständig ist.
 *
 * @param agentId - Die Agent-ID (kann null, normale ID oder WT-Alias-ID sein)
 * @returns Objekt mit baseAgentId (für Project.agentId) und isWTAssignment-Flag (für ProjectWebsite.isWTAssignment)
 *
 * @example
 * normalizeAgentIdForDB("abc123")     // { baseAgentId: "abc123", isWTAssignment: false }
 * normalizeAgentIdForDB("abc123_WT")  // { baseAgentId: "abc123", isWTAssignment: true }
 * normalizeAgentIdForDB(null)         // { baseAgentId: null, isWTAssignment: false }
 */
export function normalizeAgentIdForDB(agentId: string | null | undefined): {
  baseAgentId: string | null;
  isWTAssignment: boolean;
} {
  if (!agentId) return { baseAgentId: null, isWTAssignment: false };

  const isWT = isWTAliasId(agentId);

  // Note: Validation dass WT nur für Website-Projekte verwendet wird,
  // erfolgt auf Anwendungsebene (WT-Aliases werden nur für Website-Projekte in Dropdowns angezeigt)

  return {
    baseAgentId: getBaseAgentId(agentId),
    isWTAssignment: isWT,
  };
}

/**
 * Gets the display name for an agent, handling WT aliases
 */
export function getAgentDisplayName(
  agentId: string | null,
  isWTAssignment: boolean,
  agents: Array<{ id: string; name: string | null; email: string | null }>
): string {
  if (!agentId) return "-";

  const baseAgent = agents.find((a) => a.id === agentId);

  if (!baseAgent) return "-";

  const baseName = baseAgent.name ?? baseAgent.email ?? "Agent";

  if (isWTAssignment) {
    return getWTAliasName(baseName);
  }

  return baseName;
}

/**
 * Gets the effective agent ID for display purposes (adds _WT suffix if needed)
 */
export function getEffectiveAgentId(
  agentId: string | null,
  isWTAssignment: boolean
): string {
  if (!agentId) return "";
  return isWTAssignment ? getWTAliasId(agentId) : agentId;
}
