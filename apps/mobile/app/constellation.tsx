import React, { useEffect, useRef, useState } from "react";
import { Dimensions, StyleSheet, Text, View } from "react-native";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  runOnJS,
} from "react-native-reanimated";
import Svg, { Circle, Line, Text as SvgText, Ellipse } from "react-native-svg";
import * as d3Force from "d3-force";
import type { User } from "@constellation/types";
import { useConstellationGraph } from "@constellation/hooks";
import { useAuth } from "@constellation/hooks";
import { getRelationships, getUsersByIds } from "@constellation/api";
import { useRouter } from "expo-router";

const FALLBACK_COLOR = "#6366f1";
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

interface SimNode extends d3Force.SimulationNodeDatum {
  id: string;
  user: User;
  cluster: string;
  color: string;
}

interface SimLink extends d3Force.SimulationLinkDatum<SimNode> {
  source: string | SimNode;
  target: string | SimNode;
}

interface NodePos {
  id: string;
  x: number;
  y: number;
  color: string;
  label: string;
  cluster: string;
}

interface LinkPos {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export default function ConstellationScreen() {
  const router = useRouter();
  const { user: authUser } = useAuth();
  const [connectionUsers, setConnectionUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [nodePositions, setNodePositions] = useState<NodePos[]>([]);
  const [linkPositions, setLinkPositions] = useState<LinkPos[]>([]);

  // Fetch connected users
  useEffect(() => {
    if (!authUser) return;
    getRelationships().then((rels) => {
      const active = rels.filter((r) => r.status === "active");
      const partnerIds = active.flatMap((r) =>
        r.user_a_id === authUser.id ? [r.user_b_id] : [r.user_a_id]
      );
      getUsersByIds([...new Set(partnerIds)]).then((users) => {
        setConnectionUsers(users);
        setLoadingUsers(false);
      });
    });
  }, [authUser]);

  const { nodes, edges, userColors, loading } = useConstellationGraph(connectionUsers);

  // d3-force simulation
  useEffect(() => {
    if (!nodes.length) return;

    const simNodes: SimNode[] = nodes.map((n) => ({
      id: n.id,
      user: n.user,
      cluster: n.cluster,
      color: userColors.get(n.id) ?? FALLBACK_COLOR,
    }));

    const simLinks: SimLink[] = edges.map((e) => ({
      source: e.source,
      target: e.target,
    }));

    const centerX = SCREEN_W / 2;
    const centerY = (SCREEN_H - 120) / 2;

    const simulation = d3Force
      .forceSimulation<SimNode>(simNodes)
      .force("link", d3Force.forceLink<SimNode, SimLink>(simLinks).id((d) => d.id).distance(100))
      .force("charge", d3Force.forceManyBody().strength(-200))
      .force("center", d3Force.forceCenter(centerX, centerY))
      .force("collision", d3Force.forceCollide(30))
      .alphaDecay(0.03);

    simulation.on("tick", () => {
      const positions: NodePos[] = simNodes.map((n) => ({
        id: n.id,
        x: n.x ?? centerX,
        y: n.y ?? centerY,
        color: n.color,
        label: n.user.preferred_name ?? n.user.display_name,
        cluster: n.cluster,
      }));

      const links: LinkPos[] = simLinks.map((l) => {
        const s = l.source as SimNode;
        const t = l.target as SimNode;
        return {
          x1: s.x ?? centerX,
          y1: s.y ?? centerY,
          x2: t.x ?? centerX,
          y2: t.y ?? centerY,
        };
      });

      runOnJS(setNodePositions)(positions);
      runOnJS(setLinkPositions)(links);
    });

    return () => { simulation.stop(); };
  }, [nodes, edges, userColors]);

  // Pan + zoom with react-native-gesture-handler
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.max(0.3, Math.min(4, savedScale.value * e.scale));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const composed = Gesture.Simultaneous(pinchGesture, panGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  function handleNodePress(id: string) {
    // TODO: create app/relationships/[id].tsx detail screen
    router.push(`/relationships/${id}` as never);
  }

  // Compute cluster hulls
  const clusterHulls = React.useMemo(() => {
    const byCluster = new Map<string, NodePos[]>();
    for (const n of nodePositions) {
      const arr = byCluster.get(n.cluster) ?? [];
      arr.push(n);
      byCluster.set(n.cluster, arr);
    }
    const hulls: { cx: number; cy: number; rx: number; ry: number }[] = [];
    for (const [, members] of byCluster) {
      if (members.length < 2) continue;
      const xs = members.map((m) => m.x);
      const ys = members.map((m) => m.y);
      const minX = Math.min(...xs) - 28;
      const maxX = Math.max(...xs) + 28;
      const minY = Math.min(...ys) - 28;
      const maxY = Math.max(...ys) + 28;
      hulls.push({
        cx: (minX + maxX) / 2,
        cy: (minY + maxY) / 2,
        rx: (maxX - minX) / 2,
        ry: (maxY - minY) / 2,
      });
    }
    return hulls;
  }, [nodePositions]);

  if (loadingUsers || loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Loading constellation…</Text>
      </View>
    );
  }

  if (nodePositions.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>No connections yet.</Text>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <GestureDetector gesture={composed}>
        <Animated.View style={[styles.flex, animatedStyle]}>
          <Svg width={SCREEN_W} height={SCREEN_H}>
            {/* Cluster hulls */}
            {clusterHulls.map((h, i) => (
              <Ellipse
                key={`hull-${i}`}
                cx={h.cx}
                cy={h.cy}
                rx={h.rx}
                ry={h.ry}
                fill="rgba(99,102,241,0.07)"
                stroke="rgba(99,102,241,0.25)"
                strokeWidth={1.5}
                strokeDasharray="4 4"
              />
            ))}

            {/* Edges */}
            {linkPositions.map((l, i) => (
              <Line
                key={`link-${i}`}
                x1={l.x1}
                y1={l.y1}
                x2={l.x2}
                y2={l.y2}
                stroke="rgba(148,163,184,0.3)"
                strokeWidth={1.5}
              />
            ))}

            {/* Nodes */}
            {nodePositions.map((n) => (
              <React.Fragment key={n.id}>
                <Circle
                  cx={n.x}
                  cy={n.y}
                  r={18}
                  fill={n.color}
                  stroke="rgba(255,255,255,0.15)"
                  strokeWidth={1}
                  onPress={() => handleNodePress(n.id)}
                />
                <SvgText
                  x={n.x}
                  y={n.y + 30}
                  fontSize={11}
                  fill="rgba(249,250,251,0.8)"
                  textAnchor="middle"
                >
                  {n.label}
                </SvgText>
              </React.Fragment>
            ))}
          </Svg>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#030712" },
  center: {
    flex: 1,
    backgroundColor: "#030712",
    alignItems: "center",
    justifyContent: "center",
  },
  muted: { color: "#6b7280", fontSize: 14 },
});
