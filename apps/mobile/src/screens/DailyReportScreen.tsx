import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { v4 as uuidv4 } from 'uuid';
import api from '../api/client';
import { saveOfflineReport } from '../offline/database';

const DailyReportScreen: React.FC = () => {
  const [showForm, setShowForm] = useState(false);
  const [projectId, setProjectId] = useState('');
  const [workDone, setWorkDone] = useState('');
  const [weather, setWeather] = useState('SUNNY');
  const [completionPct, setCompletionPct] = useState('');
  const [notes, setNotes] = useState('');
  const qc = useQueryClient();

  const { data: projectsData } = useQuery({
    queryKey: ['projects-mobile'],
    queryFn: () => api.get('/projects', { params: { status: 'ACTIVE', pageSize: 50 } }),
  });
  const { data: reportsData, refetch } = useQuery({
    queryKey: ['reports-mobile'],
    queryFn: () => api.get('/daily-reports', { params: { pageSize: 20 } }),
  });

  const projects = projectsData?.data?.data || [];
  const reports = reportsData?.data?.data || [];

  const submitReport = async () => {
    if (!projectId || !workDone) { Alert.alert('Error', 'Project and work done are required'); return; }
    const reportData = {
      id: uuidv4(), projectId,
      reportDate: new Date().toISOString().split('T')[0],
      weather, workDone, completionPct: Number(completionPct) || 0, notes,
    };
    const netState = await NetInfo.fetch();
    if (netState.isConnected) {
      try {
        await api.post('/daily-reports', reportData);
        qc.invalidateQueries({ queryKey: ['reports-mobile'] });
        Alert.alert('Success', 'Report submitted successfully');
      } catch {
        await saveOfflineReport(reportData);
        Alert.alert('Saved Offline', 'Report saved and will sync when online');
      }
    } else {
      await saveOfflineReport(reportData);
      Alert.alert('Saved Offline', 'No internet. Report will sync automatically when online.');
    }
    setShowForm(false);
    setWorkDone(''); setNotes(''); setCompletionPct('');
  };

  const WEATHER = ['SUNNY','CLOUDY','RAINY','FOGGY','STORMY'];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.header}>
          <Text style={styles.title}>Daily Reports</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowForm(!showForm)}>
            <Text style={styles.addBtnText}>{showForm ? '✕ Cancel' : '+ New Report'}</Text>
          </TouchableOpacity>
        </View>

        {showForm && (
          <View style={styles.form}>
            <Text style={styles.formTitle}>New Daily Report</Text>
            <Text style={styles.label}>Project</Text>
            <View style={styles.pickerWrap}>
              {Array.isArray(projects) && projects.map((p: any) => (
                <TouchableOpacity key={p.id} style={[styles.option, projectId === p.id && styles.optionSelected]}
                  onPress={() => setProjectId(p.id)}>
                  <Text style={[styles.optionText, projectId === p.id && styles.optionTextSelected]}>{p.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.label}>Weather</Text>
            <View style={styles.weatherRow}>
              {WEATHER.map(w => (
                <TouchableOpacity key={w} style={[styles.weatherBtn, weather === w && styles.weatherBtnActive]}
                  onPress={() => setWeather(w)}>
                  <Text style={[styles.weatherText, weather === w && styles.weatherTextActive]}>
                    {w === 'SUNNY' ? '☀️' : w === 'CLOUDY' ? '⛅' : w === 'RAINY' ? '🌧️' : w === 'FOGGY' ? '🌫️' : '⛈️'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.label}>Work Done *</Text>
            <TextInput style={[styles.input, styles.textarea]} value={workDone} onChangeText={setWorkDone}
              placeholder="Describe work completed today..." multiline numberOfLines={4} textAlignVertical="top" />
            <Text style={styles.label}>Completion %</Text>
            <TextInput style={styles.input} value={completionPct} onChangeText={setCompletionPct}
              keyboardType="numeric" placeholder="35" />
            <Text style={styles.label}>Notes</Text>
            <TextInput style={[styles.input, styles.textarea]} value={notes} onChangeText={setNotes}
              placeholder="Additional notes..." multiline numberOfLines={3} textAlignVertical="top" />
            <TouchableOpacity style={styles.submitBtn} onPress={submitReport}>
              <Text style={styles.submitBtnText}>Submit Report</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.list}>
          {Array.isArray(reports) && reports.map((r: any) => (
            <View key={r.id} style={styles.reportCard}>
              <View style={styles.reportHeader}>
                <Text style={styles.reportDate}>{new Date(r.reportDate).toLocaleDateString('en-IN')}</Text>
                <Text style={styles.reportWeather}>
                  {r.weather === 'SUNNY' ? '☀️' : r.weather === 'RAINY' ? '🌧️' : '⛅'} {r.weather}
                </Text>
              </View>
              <Text style={styles.reportProject}>{r.project?.name}</Text>
              <Text style={styles.reportWork} numberOfLines={2}>{r.workDone}</Text>
              <View style={styles.reportFooter}>
                <Text style={styles.reportPct}>Completion: {r.completionPct}%</Text>
                {r.isOffline && <Text style={styles.offlineBadge}>⚠️ Offline</Text>}
              </View>
            </View>
          ))}
          {(!reports || reports.length === 0) && (
            <Text style={styles.empty}>No reports found. Create your first report!</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  title: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  addBtn: { backgroundColor: '#2563eb', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  addBtnText: { color: 'white', fontSize: 13, fontWeight: '600' },
  form: { margin: 12, backgroundColor: 'white', borderRadius: 12, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, elevation: 3 },
  formTitle: { fontSize: 16, fontWeight: '700', color: '#1e293b', marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#1e293b', backgroundColor: '#f8fafc' },
  textarea: { height: 90, paddingTop: 12 },
  pickerWrap: { gap: 6 },
  option: { padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  optionSelected: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  optionText: { fontSize: 13, color: '#475569' },
  optionTextSelected: { color: '#2563eb', fontWeight: '700' },
  weatherRow: { flexDirection: 'row', gap: 8 },
  weatherBtn: { flex: 1, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' },
  weatherBtnActive: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
  weatherText: { fontSize: 20 },
  weatherTextActive: {},
  submitBtn: { backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  submitBtnText: { color: 'white', fontSize: 15, fontWeight: '700' },
  list: { padding: 12 },
  reportCard: { backgroundColor: 'white', borderRadius: 12, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, elevation: 2 },
  reportHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  reportDate: { fontSize: 13, fontWeight: '700', color: '#1e293b' },
  reportWeather: { fontSize: 12, color: '#64748b' },
  reportProject: { fontSize: 12, color: '#2563eb', marginBottom: 6, fontWeight: '600' },
  reportWork: { fontSize: 13, color: '#475569', lineHeight: 18, marginBottom: 8 },
  reportFooter: { flexDirection: 'row', justifyContent: 'space-between' },
  reportPct: { fontSize: 12, color: '#64748b' },
  offlineBadge: { fontSize: 11, color: '#d97706', backgroundColor: '#fef3c7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  empty: { textAlign: 'center', color: '#94a3b8', padding: 40, fontSize: 14 },
});

export default DailyReportScreen;
