import { describe, it, expect } from "vitest";
import type { Relationship, User } from "@constellation/types";
import { detectPolyclueClusters } from "./detectPolyclueClusters";

// Helpers to build minimal test fixtures
function user(id: string): User {
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

function rel(
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

describe("detectPolyclueClusters", () => {
  it("returns a single-element cluster for an isolated node", () => {
    const result = detectPolyclueClusters([user("alice")], []);
    expect(result.size).toBe(1);
    const clusters = [...result.values()];
    expect(clusters[0]).toEqual(["alice"]);
  });

  it("groups two users connected by an active relationship", () => {
    const result = detectPolyclueClusters(
      [user("alice"), user("bob")],
      [rel("r1", "alice", "bob")]
    );
    expect(result.size).toBe(1);
    const members = [...result.values()][0].sort();
    expect(members).toEqual(["alice", "bob"]);
  });

  it("keeps users in separate clusters when relationship is not active", () => {
    for (const status of ["pending", "declined", "removed"] as const) {
      const result = detectPolyclueClusters(
        [user("alice"), user("bob")],
        [rel("r1", "alice", "bob", status)]
      );
      expect(result.size).toBe(2);
    }
  });

  it("merges a chain A-B-C into one cluster", () => {
    const result = detectPolyclueClusters(
      [user("a"), user("b"), user("c")],
      [rel("r1", "a", "b"), rel("r2", "b", "c")]
    );
    expect(result.size).toBe(1);
    const members = [...result.values()][0].sort();
    expect(members).toEqual(["a", "b", "c"]);
  });

  it("produces two separate clusters for disconnected pairs", () => {
    const result = detectPolyclueClusters(
      [user("a"), user("b"), user("c"), user("d")],
      [rel("r1", "a", "b"), rel("r2", "c", "d")]
    );
    expect(result.size).toBe(2);
    const allMembers = [...result.values()].map((arr) => arr.sort()).sort();
    expect(allMembers).toEqual([["a", "b"], ["c", "d"]]);
  });

  it("handles a fully connected triangle (a-b, b-c, a-c)", () => {
    const result = detectPolyclueClusters(
      [user("a"), user("b"), user("c")],
      [rel("r1", "a", "b"), rel("r2", "b", "c"), rel("r3", "a", "c")]
    );
    expect(result.size).toBe(1);
    const members = [...result.values()][0].sort();
    expect(members).toEqual(["a", "b", "c"]);
  });

  it("metamour scenario: b-c edge is inactive, c stays in its own cluster", () => {
    // a and b are active partners; b and c are pending (not active)
    // c is a metamour of a — not merged into a's cluster
    const result = detectPolyclueClusters(
      [user("a"), user("b"), user("c")],
      [rel("r1", "a", "b"), rel("r2", "b", "c", "pending")]
    );
    expect(result.size).toBe(2);
    const clusterValues = [...result.values()].map((arr) => arr.sort()).sort();
    expect(clusterValues).toContainEqual(["a", "b"]);
    expect(clusterValues).toContainEqual(["c"]);
  });

  it("returns an empty map for no nodes", () => {
    const result = detectPolyclueClusters([], []);
    expect(result.size).toBe(0);
  });

  it("ignores edges whose endpoints are not in the nodes list", () => {
    // Only alice is a known node; edge references unknown user "ghost"
    const result = detectPolyclueClusters(
      [user("alice")],
      [rel("r1", "alice", "ghost")]
    );
    // alice still ends up in a singleton cluster
    expect(result.size).toBe(1);
    const members = [...result.values()][0];
    expect(members).toEqual(["alice"]);
  });

  it("applies path compression — find is idempotent after multiple calls", () => {
    // Stress the union-find with a longer chain: a-b-c-d-e
    const nodes = ["a", "b", "c", "d", "e"].map(user);
    const edges = [
      rel("r1", "a", "b"),
      rel("r2", "b", "c"),
      rel("r3", "c", "d"),
      rel("r4", "d", "e"),
    ];
    const result = detectPolyclueClusters(nodes, edges);
    expect(result.size).toBe(1);
    const members = [...result.values()][0].sort();
    expect(members).toEqual(["a", "b", "c", "d", "e"]);
  });
});
