import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import api from '../api/client';

const ProjectsScreen: React.FC = () => {
  const [search, setSearch] = useState('');
  const { data, isRefetching, refetch } = useQuery({
    queryKey: ['mobile-projects-list', search],
    queryFn: () => api.get('/projects', { params: { search, pageSize: 20 } }),
  });
  const projects = data?.data?.data || [];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.search}>
        <TextInput style={styles.searchInput} value={search} onChangeText={setSearch}
          placeholder="Search projects..." placeholderTextColor="#94a3b8" />
      </View>
      <ScrollView refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}>
        {Array.isArray(projects) && projects.map((p: any) => (
          <View key={p.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.projectName}>{p.name}</Text>
              <Text style={styles.code}>{p.code}</Text>
            </View>
            <Text style={styles.client}>👤 {p.client?.name}</Text>
            <Text style={styles.location}>📍 {p.location}</Text>
            <View style={styles.stats}>
              <Text style={styles.budget}>₹{(Number(p.budget)/10000000).toFixed(2)}Cr</Text>
              <View style={styles.progress}>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${p.completionPct || 0}%` as any }]} />
                </View>
                <Text style={styles.progressText}>{Number(p.completionPct || 0).toFixed(0)}%</Text>
              </View>
            </View>
          </View>
        ))}
        {(!projects || projects.length === 0) && (
          <Text style={styles.empty}>No projects found</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  search: { padding: 12, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  searchInput: { backgroundColor: '#f1f5f9', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14 },
  card: { backgroundColor: 'white', margin: 12, marginBottom: 0, borderRadius: 12, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  projectName: { fontSize: 15, fontWeight: '700', color: '#1e293b', flex: 1 },
  code: { fontSize: 11, color: '#94a3b8', backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  client: { fontSize: 13, color: '#475569', marginBottom: 4 },
  location: { fontSize: 12, color: '#64748b', marginBottom: 12 },
  stats: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  budget: { fontSize: 14, fontWeight: '700', color: '#2563eb' },
  progress: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'flex-end' },
  progressBar: { width: 80, height: 6, backgroundColor: '#e2e8f0', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#2563eb', borderRadius: 3 },
  progressText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  empty: { textAlign: 'center', color: '#94a3b8', padding: 40, fontSize: 14 },
});

export default ProjectsScreen;
