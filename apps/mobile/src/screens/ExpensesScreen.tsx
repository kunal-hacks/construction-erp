import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import api from '../api/client';

const CATEGORIES = ['MATERIAL','LABOUR','FUEL','MACHINERY','TRANSPORTATION','MISCELLANEOUS'];

const ExpensesScreen: React.FC = () => {
  const [filter, setFilter] = useState('');
  const { data, isRefetching, refetch } = useQuery({
    queryKey: ['mobile-expenses', filter],
    queryFn: () => api.get('/expenses', { params: { pageSize: 20, category: filter || undefined } }),
  });
  const expenses = data?.data?.data || [];
  const COLORS: Record<string, string> = { MATERIAL: '#3b82f6', LABOUR: '#10b981', FUEL: '#f59e0b', MACHINERY: '#8b5cf6', TRANSPORTATION: '#ef4444', MISCELLANEOUS: '#64748b' };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsHorizontalScrollIndicator={false} style={styles.filterScroll} horizontal contentContainerStyle={styles.filters}>
        <TouchableOpacity style={[styles.filterChip, !filter && styles.filterChipActive]} onPress={() => setFilter('')}>
          <Text style={[styles.filterText, !filter && styles.filterTextActive]}>All</Text>
        </TouchableOpacity>
        {CATEGORIES.map(c => (
          <TouchableOpacity key={c} style={[styles.filterChip, filter === c && styles.filterChipActive]} onPress={() => setFilter(c)}>
            <Text style={[styles.filterText, filter === c && styles.filterTextActive]}>{c}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <ScrollView>
        {Array.isArray(expenses) && expenses.map((e: any) => (
          <View key={e.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.categoryBadge, { backgroundColor: COLORS[e.category] + '20' }]}>
                <Text style={[styles.categoryText, { color: COLORS[e.category] }]}>{e.category}</Text>
              </View>
              <Text style={styles.amount}>₹{Number(e.amount).toLocaleString('en-IN')}</Text>
            </View>
            <Text style={styles.description} numberOfLines={2}>{e.description}</Text>
            <View style={styles.footer}>
              <Text style={styles.date}>{new Date(e.date).toLocaleDateString('en-IN')}</Text>
              <View style={[styles.status, { backgroundColor: e.approvalStatus === 'APPROVED' ? '#dcfce7' : e.approvalStatus === 'REJECTED' ? '#fee2e2' : '#fef3c7' }]}>
                <Text style={[styles.statusText, { color: e.approvalStatus === 'APPROVED' ? '#16a34a' : e.approvalStatus === 'REJECTED' ? '#dc2626' : '#d97706' }]}>{e.approvalStatus}</Text>
              </View>
            </View>
          </View>
        ))}
        {(!expenses || expenses.length === 0) && <Text style={styles.empty}>No expenses found</Text>}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  filterScroll: { maxHeight: 50, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  filters: { paddingHorizontal: 12, paddingVertical: 8, gap: 8, flexDirection: 'row' },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#e2e8f0' },
  filterChipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  filterText: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  filterTextActive: { color: 'white' },
  card: { backgroundColor: 'white', marginHorizontal: 12, marginVertical: 5, borderRadius: 12, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  categoryBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  categoryText: { fontSize: 11, fontWeight: '700' },
  amount: { fontSize: 18, fontWeight: '800', color: '#1e293b' },
  description: { fontSize: 13, color: '#475569', marginBottom: 10, lineHeight: 18 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  date: { fontSize: 12, color: '#94a3b8' },
  status: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statusText: { fontSize: 11, fontWeight: '700' },
  empty: { textAlign: 'center', color: '#94a3b8', padding: 40, fontSize: 14 },
});

export default ExpensesScreen;
