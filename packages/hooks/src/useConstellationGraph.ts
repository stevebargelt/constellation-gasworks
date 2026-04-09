import { useEffect, useMemo, useState } from "react";
import type { Relationship, User, UserColor } from "@constellation/types";
import { detectPolyclueClusters } from "@constellation/utils";
import { getUserColors } from "@constellation/api";
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
  /** Maps target_user_id → hex color string for the current viewer. */
  userColors: Map<string, string>;
  loading: boolean;
  error: Error | null;
}

export function useConstellationGraph(
  users: User[]
): ConstellationGraph {
  const { relationships, loading: relLoading, error: relError } = useRelationships();
  const [colorRows, setColorRows] = useState<UserColor[]>([]);
  const [colorsLoading, setColorsLoading] = useState(true);
  const [colorsError, setColorsError] = useState<Error | null>(null);

  useEffect(() => {
    setColorsLoading(true);
    getUserColors()
      .then(setColorRows)
      .catch((e) => setColorsError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => setColorsLoading(false));
  }, []);

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

  const userColors = useMemo<Map<string, string>>(() => {
    const map = new Map<string, string>();
    for (const row of colorRows) {
      map.set(row.target_user_id, row.color);
    }
    return map;
  }, [colorRows]);

  return {
    nodes,
    edges,
    clusters,
    userColors,
    loading: relLoading || colorsLoading,
    error: relError ?? colorsError,
  };
}
