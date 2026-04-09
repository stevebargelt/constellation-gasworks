import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@constellation/hooks";
import {
  supabase,
  getPendingInvites,
  acceptRelationshipInvite,
  declineRelationshipInvite,
} from "@constellation/api";
import type { RelationshipWithUsers } from "@constellation/api";

function relTypeLabel(relType: string, customLabel: string | null): string {
  const labels: Record<string, string> = {
    partner: "Partner",
    nesting_partner: "Nesting Partner",
    metamour: "Metamour",
    coparent: "Co-Parent",
    roommate: "Roommate",
    family: "Family",
    custom: customLabel ?? "Custom",
  };
  return labels[relType] ?? relType;
}

export default function InvitesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [invites, setInvites] = useState<RelationshipWithUsers[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getPendingInvites();
      setInvites(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();

    const channel = supabase
      .channel("mobile-invites-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "relationships" },
        () => { load(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [load]);

  async function handleAccept(id: string) {
    setActing(id);
    try {
      await acceptRelationshipInvite(id);
      await load();
    } finally {
      setActing(null);
    }
  }

  async function handleDecline(id: string) {
    setActing(id);
    try {
      await declineRelationshipInvite(id);
      await load();
    } finally {
      setActing(null);
    }
  }

  const incoming = invites.filter((inv) => inv.user_b?.id === user?.id);
  const outgoing = invites.filter((inv) => inv.user_a?.id === user?.id);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#6366f1" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.sendButton}
        onPress={() => router.push("/invites/send")}
      >
        <Text style={styles.sendButtonText}>+ Send Invite</Text>
      </TouchableOpacity>

      {incoming.length === 0 && outgoing.length === 0 && (
        <Text style={styles.empty}>No pending invites.</Text>
      )}

      {incoming.length > 0 && (
        <>
          <Text style={styles.sectionHeader}>INCOMING</Text>
          <FlatList
            data={incoming}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <Text style={styles.cardName}>
                  {item.user_a?.display_name ?? "Unknown"}
                </Text>
                <Text style={styles.cardType}>
                  {relTypeLabel(item.rel_type, item.custom_label)}
                </Text>
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={[styles.btn, styles.btnAccept]}
                    onPress={() => handleAccept(item.id)}
                    disabled={acting === item.id}
                  >
                    <Text style={styles.btnText}>Accept</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.btn, styles.btnDecline]}
                    onPress={() => handleDecline(item.id)}
                    disabled={acting === item.id}
                  >
                    <Text style={styles.btnText}>Decline</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        </>
      )}

      {outgoing.length > 0 && (
        <>
          <Text style={styles.sectionHeader}>SENT</Text>
          <FlatList
            data={outgoing}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <View style={[styles.card, styles.cardRow]}>
                <View>
                  <Text style={styles.cardName}>
                    {item.user_b?.display_name ?? "Unknown"}
                  </Text>
                  <Text style={styles.cardType}>
                    {relTypeLabel(item.rel_type, item.custom_label)}
                  </Text>
                </View>
                <Text style={styles.pendingBadge}>Pending</Text>
              </View>
            )}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#030712",
    padding: 16,
  },
  center: {
    flex: 1,
    backgroundColor: "#030712",
    alignItems: "center",
    justifyContent: "center",
  },
  sendButton: {
    backgroundColor: "#4f46e5",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 20,
  },
  sendButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 15,
  },
  empty: {
    color: "#6b7280",
    textAlign: "center",
    marginTop: 40,
  },
  sectionHeader: {
    color: "#9ca3af",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 4,
  },
  card: {
    backgroundColor: "#111827",
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardName: {
    color: "#f9fafb",
    fontSize: 16,
    fontWeight: "600",
  },
  cardType: {
    color: "#9ca3af",
    fontSize: 13,
    marginTop: 2,
  },
  cardActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  btn: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  btnAccept: {
    backgroundColor: "#4f46e5",
  },
  btnDecline: {
    backgroundColor: "#1f2937",
  },
  btnText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  pendingBadge: {
    color: "#fbbf24",
    fontSize: 12,
    fontWeight: "600",
  },
});
