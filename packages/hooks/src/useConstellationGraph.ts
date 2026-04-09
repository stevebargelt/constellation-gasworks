import { useMemo } from "react";
import type { Relationship, User } from "@constellation/types";
import { detectPolyclueClusters } from "@constellation/utils";
import { colors } from "@constellation/theme";
import { useRelationships } from "./useRelationships";

interface GraphNode {
  id: string;
  user: User;
  cluster: string;
}

interface GraphEdge {
  source: string;
  target: string;
  relationship: Relationship;
}

interface ConstellationGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  clusters: Map<string, string[]>;
  userColors: Map<string, string>;
  loading: boolean;
  error: Error | null;
}

export function useConstellationGraph(users: User[]): ConstellationGraph {
  const { relationships, loading, error } = useRelationships();

  const clusters = useMemo(() => {
    if (!relationships.length || !users.length) return new Map<string, string[]>();
    return detectPolyclueClusters(users, relationships.filter((r) => r.status === "active"));
  }, [users, relationships]);

  const nodes = useMemo<GraphNode[]>(() => {
    return users.map((user) => ({
      id: user.id,
      user,
      cluster:
        [...clusters.entries()].find(([, ids]) => ids.includes(user.id))?.[0] ?? "none",
    }));
  }, [users, clusters]);

  const edges = useMemo<GraphEdge[]>(() => {
    return relationships
      .filter((r) => r.status === "active")
      .map((r) => ({ source: r.user_a_id, target: r.user_b_id, relationship: r }));
  }, [relationships]);

  // Assign a stable color from the person palette to each user by index.
  // Sorted by user ID for determinism across renders/sessions.
  const userColors = useMemo<Map<string, string>>(() => {
    const palette = colors.person as readonly string[];
    const sorted = [...users].sort((a, b) => a.id.localeCompare(b.id));
    return new Map(sorted.map((user, i) => [user.id, palette[i % palette.length]]));
  }, [users]);

  return { nodes, edges, clusters, userColors, loading, error };
}
