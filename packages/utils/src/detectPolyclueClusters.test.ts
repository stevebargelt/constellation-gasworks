import { describe, expect, it } from "vitest";
import type { Relationship, User } from "@constellation/types";
import { detectPolyclueClusters, getMetamours } from "./detectPolyclueClusters";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeUser(id: string): User {
  return {
    id,
    display_name: id,
    preferred_name: null,
    pronouns: null,
    avatar_url: null,
    username: id,
    created_at: "2024-01-01T00:00:00Z",
  };
}

function makeEdge(
  id: string,
  a: string,
  b: string,
  status: Relationship["status"] = "active"
): Relationship {
  return {
    id,
    user_a_id: a,
    user_b_id: b,
    rel_type: "partner",
    custom_label: null,
    status,
    created_at: "2024-01-01T00:00:00Z",
  };
}

// ---------------------------------------------------------------------------
// detectPolyclueClusters
// ---------------------------------------------------------------------------

describe("detectPolyclueClusters", () => {
  it("places every user in a singleton cluster when there are no edges", () => {
    const nodes = ["alice", "bob", "carol"].map(makeUser);
    const result = detectPolyclueClusters(nodes, []);
    expect(result.size).toBe(3);
    for (const cluster of result.values()) {
      expect(cluster).toHaveLength(1);
    }
  });

  it("groups two directly connected users into one cluster", () => {
    const nodes = ["alice", "bob"].map(makeUser);
    const edges = [makeEdge("e1", "alice", "bob")];
    const result = detectPolyclueClusters(nodes, edges);
    expect(result.size).toBe(1);
    const members = Array.from(result.values())[0].sort();
    expect(members).toEqual(["alice", "bob"]);
  });

  it("ignores non-active edges", () => {
    const nodes = ["alice", "bob"].map(makeUser);
    const edges = [makeEdge("e1", "alice", "bob", "pending")];
    const result = detectPolyclueClusters(nodes, edges);
    expect(result.size).toBe(2); // still separate clusters
  });

  it("merges a V-shaped polycule into one cluster", () => {
    // alice — bob — carol (bob is the hinge)
    const nodes = ["alice", "bob", "carol"].map(makeUser);
    const edges = [
      makeEdge("e1", "alice", "bob"),
      makeEdge("e2", "bob", "carol"),
    ];
    const result = detectPolyclueClusters(nodes, edges);
    expect(result.size).toBe(1);
    const members = Array.from(result.values())[0].sort();
    expect(members).toEqual(["alice", "bob", "carol"]);
  });

  it("identifies two separate clusters correctly", () => {
    // cluster A: alice — bob; cluster B: carol — dave
    const nodes = ["alice", "bob", "carol", "dave"].map(makeUser);
    const edges = [
      makeEdge("e1", "alice", "bob"),
      makeEdge("e2", "carol", "dave"),
    ];
    const result = detectPolyclueClusters(nodes, edges);
    expect(result.size).toBe(2);
    const allSets = Array.from(result.values()).map((arr) => arr.sort());
    expect(allSets).toEqual(
      expect.arrayContaining([["alice", "bob"], ["carol", "dave"]])
    );
  });

  it("handles an empty node list", () => {
    const result = detectPolyclueClusters([], []);
    expect(result.size).toBe(0);
  });

  it("handles a single node with no edges", () => {
    const nodes = [makeUser("alice")];
    const result = detectPolyclueClusters(nodes, []);
    expect(result.size).toBe(1);
    const members = Array.from(result.values())[0];
    expect(members).toEqual(["alice"]);
  });

  it("uses path compression correctly in a chain: a—b—c—d", () => {
    const nodes = ["a", "b", "c", "d"].map(makeUser);
    const edges = [
      makeEdge("e1", "a", "b"),
      makeEdge("e2", "b", "c"),
      makeEdge("e3", "c", "d"),
    ];
    const result = detectPolyclueClusters(nodes, edges);
    expect(result.size).toBe(1);
    const members = Array.from(result.values())[0].sort();
    expect(members).toEqual(["a", "b", "c", "d"]);
  });

  it("does not include edge participants who are not in the nodes list", () => {
    // Only alice is in nodes; edge references bob who is not
    const nodes = [makeUser("alice")];
    const edges = [makeEdge("e1", "alice", "ghost")];
    const result = detectPolyclueClusters(nodes, edges);
    // alice should be in a cluster; ghost should not appear
    const allIds = Array.from(result.values()).flat();
    expect(allIds).not.toContain("ghost");
  });
});

// ---------------------------------------------------------------------------
// getMetamours
// ---------------------------------------------------------------------------

describe("getMetamours", () => {
  it("returns empty array when user has no partners", () => {
    const edges = [makeEdge("e1", "bob", "carol")];
    expect(getMetamours("alice", edges)).toEqual([]);
  });

  it("returns empty array when none of the user's partners have other partners", () => {
    const edges = [makeEdge("e1", "alice", "bob")];
    expect(getMetamours("alice", edges)).toEqual([]);
  });

  it("returns carol as alice's metamour via bob", () => {
    // alice — bob — carol
    const edges = [
      makeEdge("e1", "alice", "bob"),
      makeEdge("e2", "bob", "carol"),
    ];
    const metamours = getMetamours("alice", edges);
    expect(metamours).toEqual(["carol"]);
  });

  it("does not include direct partners as metamours", () => {
    // alice — bob — carol, alice — carol (direct)
    const edges = [
      makeEdge("e1", "alice", "bob"),
      makeEdge("e2", "bob", "carol"),
      makeEdge("e3", "alice", "carol"),
    ];
    const metamours = getMetamours("alice", edges);
    expect(metamours).not.toContain("carol");
  });

  it("ignores non-active edges when computing metamours", () => {
    const edges = [
      makeEdge("e1", "alice", "bob"),
      makeEdge("e2", "bob", "carol", "pending"),
    ];
    expect(getMetamours("alice", edges)).toEqual([]);
  });

  it("returns multiple metamours from multiple partners", () => {
    // alice — bob — carol
    // alice — dave — eve
    const edges = [
      makeEdge("e1", "alice", "bob"),
      makeEdge("e2", "bob", "carol"),
      makeEdge("e3", "alice", "dave"),
      makeEdge("e4", "dave", "eve"),
    ];
    const metamours = getMetamours("alice", edges).sort();
    expect(metamours).toEqual(["carol", "eve"]);
  });

  it("does not include alice herself as a metamour", () => {
    // cycle: alice — bob — alice (shouldn't happen in practice, but be safe)
    const edges = [
      makeEdge("e1", "alice", "bob"),
      makeEdge("e2", "bob", "alice"),
    ];
    const metamours = getMetamours("alice", edges);
    expect(metamours).not.toContain("alice");
  });

  it("deduplicates metamours shared by multiple partners", () => {
    // alice — bob — carol
    // alice — dave — carol  (carol is metamour via both bob and dave)
    const edges = [
      makeEdge("e1", "alice", "bob"),
      makeEdge("e2", "bob", "carol"),
      makeEdge("e3", "alice", "dave"),
      makeEdge("e4", "dave", "carol"),
    ];
    const metamours = getMetamours("alice", edges);
    expect(metamours).toEqual(["carol"]); // not duplicated
  });
});
