/**
 * Helper functions for managing Web-Agents and their WT (Webtermin) aliases.
 *
 * Web-Agents can have a WT alias for web projects (e.g., "Nico" has "Nico WT").
 * These are NOT separate agents but aliases that map to the same base agent.
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
 * Generates a WT alias ID from a base agent ID
 */
export function getWTAliasId(baseAgentId: string): string {
  return `${baseAgentId}_WT`;
}

/**
 * Generates a WT alias name from a base agent name
 */
export function getWTAliasName(baseAgentName: string | null): string {
  if (!baseAgentName) return "WT";
  return `${baseAgentName} WT`;
}

/**
 * Checks if an agent ID is a WT alias
 */
export function isWTAliasId(agentId: string): boolean {
  return agentId.endsWith("_WT");
}

/**
 * Extracts the base agent ID from a WT alias ID
 */
export function getBaseAgentId(agentId: string): string {
  if (isWTAliasId(agentId)) {
    return agentId.slice(0, -3); // Remove "_WT" suffix
  }
  return agentId;
}

/**
 * Expands a list of agents to include WT aliases for web projects
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
 * Converts a potentially WT alias agent ID back to the base agent ID and isWTAssignment flag for database queries
 */
export function normalizeAgentIdForDB(agentId: string | null | undefined): {
  baseAgentId: string | null;
  isWTAssignment: boolean;
} {
  if (!agentId) return { baseAgentId: null, isWTAssignment: false };

  const isWT = isWTAliasId(agentId);
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
