import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import api from '../api/client';
import { syncPendingData } from '../offline/syncService';

const ProfileScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [user, setUser] = useState<any>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync('user').then(u => { if (u) setUser(JSON.parse(u)); });
  }, []);

  const handleLogout = async () => {
    await SecureStore.deleteItemAsync('accessToken');
    await SecureStore.deleteItemAsync('refreshToken');
    await SecureStore.deleteItemAsync('user');
    navigation.replace('Login');
  };

  const handleSync = async () => {
    setSyncing(true);
    const result = await syncPendingData();
    setSyncing(false);
    Alert.alert('Sync Complete', `Synced: ${result.synced}, Failed: ${result.failed}`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.avatar}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{user?.firstName?.[0]}{user?.lastName?.[0]}</Text>
          </View>
          <Text style={styles.name}>{user?.firstName} {user?.lastName}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          <View style={styles.roleBadge}><Text style={styles.roleText}>{user?.role?.replace(/_/g,' ')}</Text></View>
        </View>
        <View style={styles.actions}>
          <TouchableOpacity style={styles.syncBtn} onPress={handleSync} disabled={syncing}>
            <Text style={styles.syncBtnText}>{syncing ? '⏳ Syncing...' : '🔄 Sync Offline Data'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutBtnText}>🚪 Logout</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  avatar: { alignItems: 'center', padding: 32, backgroundColor: 'white', marginBottom: 12 },
  avatarCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#dbeafe', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText: { fontSize: 28, fontWeight: '800', color: '#2563eb' },
  name: { fontSize: 20, fontWeight: '700', color: '#1e293b' },
  email: { fontSize: 13, color: '#64748b', marginTop: 4 },
  roleBadge: { backgroundColor: '#eff6ff', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, marginTop: 10 },
  roleText: { color: '#2563eb', fontSize: 12, fontWeight: '700' },
  actions: { padding: 16, gap: 12 },
  syncBtn: { backgroundColor: 'white', borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 2, borderColor: '#2563eb' },
  syncBtnText: { color: '#2563eb', fontSize: 15, fontWeight: '700' },
  logoutBtn: { backgroundColor: '#fee2e2', borderRadius: 12, padding: 16, alignItems: 'center' },
  logoutBtnText: { color: '#dc2626', fontSize: 15, fontWeight: '700' },
});

export default ProfileScreen;
