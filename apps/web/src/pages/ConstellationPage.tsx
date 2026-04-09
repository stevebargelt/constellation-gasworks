import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ForceGraph2D } from "react-force-graph";
import type { User } from "@constellation/types";
import { useConstellationGraph, useAuth } from "@constellation/hooks";
import { getRelationships, getUsersByIds } from "@constellation/api";

// Fallback color when no assignment exists
const FALLBACK_COLOR = "#6366f1";

interface GraphNodeDatum {
  id: string;
  user: User;
  cluster: string;
  color: string;
  isDirect: boolean;
}

interface GraphLinkDatum {
  source: string;
  target: string;
}

export default function ConstellationPage() {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const [connectionUsers, setConnectionUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  // Fetch connected users from active relationships
  useEffect(() => {
    if (!authUser) return;
    getRelationships().then((rels) => {
      const active = rels.filter((r) => r.status === "active");
      const partnerIds = active.flatMap((r) =>
        r.user_a_id === authUser.id ? [r.user_b_id] : [r.user_a_id]
      );
      const unique = [...new Set(partnerIds)];
      getUsersByIds(unique).then((users) => {
        setConnectionUsers(users);
        setLoadingUsers(false);
      });
    });
  }, [authUser]);

  const { nodes, edges, userColors, loading } = useConstellationGraph(connectionUsers);

  // Build graph data for react-force-graph
  const graphData = React.useMemo(() => {
    const graphNodes: GraphNodeDatum[] = nodes.map((n) => ({
      id: n.id,
      user: n.user,
      cluster: n.cluster,
      color: userColors.get(n.id) ?? FALLBACK_COLOR,
      isDirect: true,
    }));

    const graphLinks: GraphLinkDatum[] = edges.map((e) => ({
      source: e.source,
      target: e.target,
    }));

    return { nodes: graphNodes, links: graphLinks };
  }, [nodes, edges, userColors]);

  const handleNodeClick = useCallback(
    (node: GraphNodeDatum) => {
      navigate(`/relationships/${node.id}`);
    },
    [navigate]
  );

  // Custom canvas painter: draw cluster hull behind nodes
  const paintClusterHull = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      if (!graphData.nodes.length) return;

      // Group nodes by cluster
      const byCluster = new Map<string, GraphNodeDatum[]>();
      for (const n of graphData.nodes as (GraphNodeDatum & { x?: number; y?: number })[]) {
        if (n.x == null || n.y == null) continue;
        const arr = byCluster.get(n.cluster) ?? [];
        arr.push(n as GraphNodeDatum);
        byCluster.set(n.cluster, arr);
      }

      for (const [, members] of byCluster) {
        if (members.length < 2) continue;
        const pts = members as (GraphNodeDatum & { x: number; y: number })[];
        const xs = pts.map((p) => p.x);
        const ys = pts.map((p) => p.y);
        const minX = Math.min(...xs) - 28;
        const maxX = Math.max(...xs) + 28;
        const minY = Math.min(...ys) - 28;
        const maxY = Math.max(...ys) + 28;
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        const rx = (maxX - minX) / 2;
        const ry = (maxY - minY) / 2;

        ctx.save();
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
        ctx.fillStyle = "rgba(99,102,241,0.08)";
        ctx.fill();
        ctx.strokeStyle = "rgba(99,102,241,0.25)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.restore();
      }
    },
    [graphData]
  );

  if (loadingUsers || loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-500 text-sm">Loading constellation…</p>
      </div>
    );
  }

  if (graphData.nodes.length === 0) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4">
        <p className="text-gray-400">No connections yet.</p>
        <Link to="/invite" className="text-blue-400 hover:text-blue-300 text-sm">
          Send your first invite →
        </Link>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen bg-gray-950 overflow-hidden">
      {/* Nav */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-3">
        <Link to="/" className="text-gray-400 hover:text-white text-sm">← Home</Link>
        <span className="text-gray-600 text-sm">Constellation</span>
      </div>

      <ForceGraph2D
        graphData={graphData}
        backgroundColor="#030712"
        nodeId="id"
        nodeLabel={(node) => (node as GraphNodeDatum).user.display_name}
        nodeColor={(node) => (node as GraphNodeDatum).color}
        nodeRelSize={8}
        linkColor={() => "rgba(148,163,184,0.3)"}
        linkWidth={1.5}
        onNodeClick={(node) => handleNodeClick(node as GraphNodeDatum)}
        onBackgroundClick={() => undefined}
        enableZoomInteraction
        enablePanInteraction
        onRenderFramePre={paintClusterHull}
        nodeCanvasObject={(node, ctx, globalScale) => {
          const n = node as GraphNodeDatum & { x: number; y: number };
          const r = 8;
          // Node circle
          ctx.beginPath();
          ctx.arc(n.x, n.y, r, 0, 2 * Math.PI);
          ctx.fillStyle = n.color;
          ctx.fill();
          ctx.strokeStyle = "rgba(255,255,255,0.15)";
          ctx.lineWidth = 1;
          ctx.stroke();

          // Label (only when zoomed in enough)
          if (globalScale >= 0.8) {
            const label = n.user.preferred_name ?? n.user.display_name;
            const fontSize = Math.max(10, 12 / globalScale);
            ctx.font = `${fontSize}px sans-serif`;
            ctx.fillStyle = "rgba(249,250,251,0.85)";
            ctx.textAlign = "center";
            ctx.fillText(label, n.x, n.y + r + fontSize * 0.9);
          }
        }}
        nodeCanvasObjectMode={() => "replace"}
      />
    </div>
  );
}
