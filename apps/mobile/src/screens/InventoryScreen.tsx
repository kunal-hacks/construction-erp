import React from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import api from '../api/client';

const InventoryScreen: React.FC = () => {
  const { data: projectsData } = useQuery({
    queryKey: ['projects-mobile-inv'],
    queryFn: () => api.get('/projects', { params: { status: 'ACTIVE', pageSize: 5 } }),
  });
  const projects = projectsData?.data?.data || [];
  const firstProject = Array.isArray(projects) ? projects[0] : null;

  const { data, isRefetching, refetch } = useQuery({
    queryKey: ['inventory-mobile', firstProject?.id],
    queryFn: () => firstProject ? api.get(`/inventory/project/${firstProject.id}`) : Promise.resolve(null),
    enabled: !!firstProject?.id,
  });
  const items = data?.data?.data || [];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}>
        <View style={styles.header}>
          <Text style={styles.title}>Inventory</Text>
          {firstProject && <Text style={styles.project}>{firstProject.name}</Text>}
        </View>
        {Array.isArray(items) && items.map((item: any) => (
          <View key={item.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.materialName}>{item.material?.name}</Text>
              <Text style={styles.stock}>{Number(item.currentStock).toFixed(2)} {item.material?.unit}</Text>
            </View>
            <Text style={styles.category}>{item.material?.category?.name}</Text>
            <View style={styles.footer}>
              <Text style={styles.rate}>Avg Rate: ₹{Number(item.avgRate).toLocaleString('en-IN')}/{item.material?.unit}</Text>
              <Text style={styles.value}>Value: ₹{Number(item.totalValue || 0).toLocaleString('en-IN')}</Text>
            </View>
          </View>
        ))}
        {(!items || items.length === 0) && !isRefetching && (
          <Text style={styles.empty}>No inventory data available</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { padding: 16, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  title: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  project: { fontSize: 12, color: '#64748b', marginTop: 2 },
  card: { backgroundColor: 'white', margin: 12, marginBottom: 0, borderRadius: 12, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  materialName: { fontSize: 14, fontWeight: '700', color: '#1e293b', flex: 1 },
  stock: { fontSize: 16, fontWeight: '800', color: '#2563eb' },
  category: { fontSize: 12, color: '#64748b', marginBottom: 10 },
  footer: { flexDirection: 'row', justifyContent: 'space-between' },
  rate: { fontSize: 12, color: '#475569' },
  value: { fontSize: 12, fontWeight: '600', color: '#10b981' },
  empty: { textAlign: 'center', color: '#94a3b8', padding: 40, fontSize: 14 },
});

export default InventoryScreen;
