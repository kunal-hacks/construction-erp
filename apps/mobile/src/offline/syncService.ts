import NetInfo from '@react-native-community/netinfo';
import {
  getUnsyncedReports, markReportSynced,
  getUnsyncedExpenses, markExpenseSynced
} from './database';
import api from '../api/client';

let syncInProgress = false;

export const syncPendingData = async (): Promise<{
  synced: number;
  failed: number;
  errors: string[];
}> => {
  if (syncInProgress) return { synced: 0, failed: 0, errors: ['Sync already in progress'] };

  const netState = await NetInfo.fetch();
  if (!netState.isConnected) {
    return { synced: 0, failed: 0, errors: ['No internet connection'] };
  }

  syncInProgress = true;
  let synced = 0;
  let failed = 0;
  const errors: string[] = [];

  try {
    // Sync daily reports
    const unsyncedReports = await getUnsyncedReports();
    for (const report of unsyncedReports) {
      try {
        await api.post('/daily-reports', {
          projectId: report.project_id,
          reportDate: report.report_date,
          weather: report.weather,
          workDone: report.work_done,
          completionPct: report.completion_pct,
          notes: report.notes,
          isOffline: true,
        });
        await markReportSynced(report.id);
        synced++;
      } catch (error) {
        failed++;
        errors.push(`Report ${report.id}: ${error}`);
      }
    }

    // Sync expenses
    const unsyncedExpenses = await getUnsyncedExpenses();
    for (const expense of unsyncedExpenses) {
      try {
        await api.post('/expenses', {
          projectId: expense.project_id,
          date: expense.date,
          amount: expense.amount,
          category: expense.category,
          vendorId: expense.vendor_id,
          description: expense.description,
          isOffline: true,
        });
        await markExpenseSynced(expense.id);
        synced++;
      } catch (error) {
        failed++;
        errors.push(`Expense ${expense.id}: ${error}`);
      }
    }

    return { synced, failed, errors };
  } finally {
    syncInProgress = false;
  }
};

export const setupAutoSync = (intervalMs: number = 30000) => {
  const unsubscribe = NetInfo.addEventListener((state) => {
    if (state.isConnected) {
      syncPendingData().then((result) => {
        if (result.synced > 0) {
          console.log(`Auto-synced ${result.synced} records`);
        }
      });
    }
  });

  const interval = setInterval(async () => {
    const netState = await NetInfo.fetch();
    if (netState.isConnected) {
      await syncPendingData();
    }
  }, intervalMs);

  return () => {
    unsubscribe();
    clearInterval(interval);
  };
};
