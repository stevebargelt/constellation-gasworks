import type { Relationship, User } from "@constellation/types";

/**
 * Identifies polycule clusters using union-find on the direct relationship graph.
 * Returns a map of cluster ID → array of user IDs in that cluster.
 * Single nodes (no active relationships) are placed in a singleton cluster.
 */
export function detectPolyclueClusters(
  nodes: User[],
  edges: Relationship[]
): Map<string, string[]> {
  const parent = new Map<string, string>();

  const find = (id: string): string => {
    if (!parent.has(id)) parent.set(id, id);
    const p = parent.get(id)!;
    if (p !== id) {
      parent.set(id, find(p));
    }
    return parent.get(id)!;
  };

  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  for (const node of nodes) find(node.id);
  for (const edge of edges) {
    if (edge.status === "active") {
      union(edge.user_a_id, edge.user_b_id);
    }
  }

  const clusters = new Map<string, string[]>();
  for (const node of nodes) {
    const root = find(node.id);
    const cluster = clusters.get(root) ?? [];
    cluster.push(node.id);
    clusters.set(root, cluster);
  }

  return clusters;
}

/**
 * Returns metamour IDs for a given user.
 * A metamour is a partner's partner who is not directly connected to the user.
 * Only considers active relationships.
 *
 * @param userId - The focal user's ID
 * @param edges - All relationship edges in the graph
 * @returns Array of user IDs who are metamours of the given user
 */
export function getMetamours(userId: string, edges: Relationship[]): string[] {
  const activeEdges = edges.filter((e) => e.status === "active");

  const directPartners = new Set<string>();
  for (const edge of activeEdges) {
    if (edge.user_a_id === userId) directPartners.add(edge.user_b_id);
    else if (edge.user_b_id === userId) directPartners.add(edge.user_a_id);
  }

  const metamours = new Set<string>();
  for (const partnerId of directPartners) {
    for (const edge of activeEdges) {
      if (edge.user_a_id === partnerId) {
        const candidate = edge.user_b_id;
        if (candidate !== userId && !directPartners.has(candidate)) {
          metamours.add(candidate);
        }
      } else if (edge.user_b_id === partnerId) {
        const candidate = edge.user_a_id;
        if (candidate !== userId && !directPartners.has(candidate)) {
          metamours.add(candidate);
        }
      }
    }
  }

  return Array.from(metamours);
}
