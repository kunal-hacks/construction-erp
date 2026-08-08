import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import api from '../api/client';

const StatCard: React.FC<{ title: string; value: string; color: string; icon: string }> = ({ title, value, color, icon }) => (
  <View style={[styles.statCard, { borderLeftColor: color }]}>
    <Text style={styles.statIcon}>{icon}</Text>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statTitle}>{title}</Text>
  </View>
);

const DashboardScreen: React.FC = () => {
  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['mobile-dashboard'],
    queryFn: () => api.get('/analytics/dashboard'),
  });
  const { data: projectsData } = useQuery({
    queryKey: ['mobile-projects'],
    queryFn: () => api.get('/projects', { params: { pageSize: 5, status: 'ACTIVE' } }),
  });

  const dashboard = data?.data?.data;
  const projects = projectsData?.data?.data || [];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}>
        <View style={styles.header}>
          <Text style={styles.greeting}>Good morning! 👋</Text>
          <Text style={styles.subtitle}>Construction ERP Dashboard</Text>
        </View>

        {dashboard && (
          <View style={styles.statsGrid}>
            <StatCard title="Projects" value={String(dashboard.overview?.totalProjects || 0)} color="#2563eb" icon="📁" />
            <StatCard title="Budget Used" value={`${dashboard.overview?.budgetUtilization || 0}%`} color="#10b981" icon="💰" />
            <StatCard title="Pending" value={String(dashboard.overview?.pendingApprovals || 0)} color="#f59e0b" icon="⏳" />
            <StatCard title="Active" value={String(dashboard.overview?.activeProjects || 0)} color="#8b5cf6" icon="⚡" />
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Active Projects</Text>
          {Array.isArray(projects) && projects.slice(0, 5).map((p: any) => (
            <View key={p.id} style={styles.projectCard}>
              <View style={styles.projectHeader}>
                <Text style={styles.projectName}>{p.name}</Text>
                <View style={[styles.badge, { backgroundColor: p.status === 'ACTIVE' ? '#dcfce7' : '#f1f5f9' }]}>
                  <Text style={[styles.badgeText, { color: p.status === 'ACTIVE' ? '#16a34a' : '#64748b' }]}>{p.status}</Text>
                </View>
              </View>
              <Text style={styles.projectLocation}>📍 {p.location}</Text>
              <View style={styles.progressRow}>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${p.completionPct || 0}%` as any }]} />
                </View>
                <Text style={styles.progressText}>{Number(p.completionPct || 0).toFixed(0)}%</Text>
              </View>
            </View>
          ))}
          {(!projects || projects.length === 0) && !isLoading && (
            <Text style={styles.emptyText}>No active projects</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { padding: 20, paddingBottom: 10 },
  greeting: { fontSize: 22, fontWeight: '800', color: '#1e293b' },
  subtitle: { fontSize: 13, color: '#64748b', marginTop: 2 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 12 },
  statCard: { flex: 1, minWidth: '45%', backgroundColor: 'white', borderRadius: 12, padding: 14, borderLeftWidth: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, elevation: 2 },
  statIcon: { fontSize: 24, marginBottom: 6 },
  statValue: { fontSize: 22, fontWeight: '800', color: '#1e293b' },
  statTitle: { fontSize: 11, color: '#64748b', marginTop: 2, fontWeight: '500' },
  section: { margin: 16, marginTop: 20 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 12 },
  projectCard: { backgroundColor: 'white', borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, elevation: 2 },
  projectHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  projectName: { fontSize: 14, fontWeight: '700', color: '#1e293b', flex: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  projectLocation: { fontSize: 12, color: '#64748b', marginBottom: 10 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressBar: { flex: 1, height: 6, backgroundColor: '#e2e8f0', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#2563eb', borderRadius: 3 },
  progressText: { fontSize: 11, fontWeight: '700', color: '#475569', width: 32 },
  emptyText: { textAlign: 'center', color: '#94a3b8', fontSize: 14, padding: 24 },
});

export default DashboardScreen;
