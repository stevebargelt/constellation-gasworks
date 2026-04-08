import { useMemo } from "react";
import type { Relationship, User } from "@constellation/types";
import { detectPolyclueClusters } from "@constellation/utils";
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
  loading: boolean;
  error: Error | null;
}

export function useConstellationGraph(
  users: User[]
): ConstellationGraph {
  const { relationships, loading, error } = useRelationships();

  const clusters = useMemo(() => {
    if (!relationships.length || !users.length) return new Map<string, string[]>();
    const activeRelationships = relationships.filter((r) => r.status === "active");
    return detectPolyclueClusters(users, activeRelationships);
  }, [users, relationships]);

  const nodes = useMemo<GraphNode[]>(() => {
    return users.map((user) => ({
      id: user.id,
      user,
      cluster: [...clusters.entries()].find(([, ids]) => ids.includes(user.id))?.[0] ?? "none",
    }));
  }, [users, clusters]);

  const edges = useMemo<GraphEdge[]>(() => {
    return relationships
      .filter((r) => r.status === "active")
      .map((r) => ({ source: r.user_a_id, target: r.user_b_id, relationship: r }));
  }, [relationships]);

  return { nodes, edges, clusters, loading, error };
}
