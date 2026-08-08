import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabase('construction_erp.db');

export const initDatabase = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.transaction(
      (tx) => {
        // Offline Daily Reports
        tx.executeSql(`
          CREATE TABLE IF NOT EXISTS offline_reports (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            report_date TEXT NOT NULL,
            weather TEXT DEFAULT 'SUNNY',
            work_done TEXT NOT NULL,
            completion_pct REAL DEFAULT 0,
            notes TEXT,
            synced INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Offline Expenses
        tx.executeSql(`
          CREATE TABLE IF NOT EXISTS offline_expenses (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            date TEXT NOT NULL,
            amount REAL NOT NULL,
            category TEXT NOT NULL,
            vendor_id TEXT,
            description TEXT NOT NULL,
            receipt_path TEXT,
            synced INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Offline Truck Entries
        tx.executeSql(`
          CREATE TABLE IF NOT EXISTS offline_truck_entries (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            date TEXT NOT NULL,
            time TEXT NOT NULL,
            truck_number TEXT NOT NULL,
            driver_name TEXT NOT NULL,
            vendor_id TEXT,
            material_id TEXT,
            gross_weight REAL NOT NULL,
            tare_weight REAL NOT NULL,
            net_weight REAL NOT NULL,
            notes TEXT,
            synced INTEGER DEFAULT 0,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Sync Queue
        tx.executeSql(`
          CREATE TABLE IF NOT EXISTS sync_queue (
            id TEXT PRIMARY KEY,
            table_name TEXT NOT NULL,
            record_id TEXT NOT NULL,
            operation TEXT NOT NULL,
            data TEXT NOT NULL,
            attempts INTEGER DEFAULT 0,
            last_attempt TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `);

        // Cached Projects (for offline access)
        tx.executeSql(`
          CREATE TABLE IF NOT EXISTS cached_projects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            code TEXT,
            location TEXT,
            status TEXT,
            data TEXT,
            cached_at TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `);
      },
      (error) => {
        console.error('Database init error:', error);
        reject(error);
      },
      () => {
        console.log('Database initialized');
        resolve();
      }
    );
  });
};

// Daily Reports
export const saveOfflineReport = (report: {
  id: string;
  projectId: string;
  reportDate: string;
  weather: string;
  workDone: string;
  completionPct: number;
  notes?: string;
}): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql(
        `INSERT OR REPLACE INTO offline_reports 
         (id, project_id, report_date, weather, work_done, completion_pct, notes, synced)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
        [report.id, report.projectId, report.reportDate, report.weather,
         report.workDone, report.completionPct, report.notes || null],
        () => resolve(),
        (_, error) => { reject(error); return true; }
      );
    });
  });
};

export const getUnsyncedReports = (): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql(
        'SELECT * FROM offline_reports WHERE synced = 0 ORDER BY created_at ASC',
        [],
        (_, result) => resolve(result.rows._array),
        (_, error) => { reject(error); return true; }
      );
    });
  });
};

export const markReportSynced = (id: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql(
        'UPDATE offline_reports SET synced = 1 WHERE id = ?',
        [id],
        () => resolve(),
        (_, error) => { reject(error); return true; }
      );
    });
  });
};

// Expenses
export const saveOfflineExpense = (expense: {
  id: string;
  projectId: string;
  date: string;
  amount: number;
  category: string;
  vendorId?: string;
  description: string;
  receiptPath?: string;
}): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql(
        `INSERT OR REPLACE INTO offline_expenses
         (id, project_id, date, amount, category, vendor_id, description, receipt_path, synced)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [expense.id, expense.projectId, expense.date, expense.amount,
         expense.category, expense.vendorId || null, expense.description,
         expense.receiptPath || null],
        () => resolve(),
        (_, error) => { reject(error); return true; }
      );
    });
  });
};

export const getUnsyncedExpenses = (): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql(
        'SELECT * FROM offline_expenses WHERE synced = 0',
        [],
        (_, result) => resolve(result.rows._array),
        (_, error) => { reject(error); return true; }
      );
    });
  });
};

export const markExpenseSynced = (id: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql(
        'UPDATE offline_expenses SET synced = 1 WHERE id = ?',
        [id],
        () => resolve(),
        (_, error) => { reject(error); return true; }
      );
    });
  });
};

// Cache projects
export const cacheProjects = (projects: any[]): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql('DELETE FROM cached_projects');
      projects.forEach((p) => {
        tx.executeSql(
          'INSERT INTO cached_projects (id, name, code, location, status, data) VALUES (?, ?, ?, ?, ?, ?)',
          [p.id, p.name, p.code, p.location, p.status, JSON.stringify(p)]
        );
      });
    },
    (error) => reject(error),
    () => resolve());
  });
};

export const getCachedProjects = (): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    db.transaction((tx) => {
      tx.executeSql(
        'SELECT * FROM cached_projects',
        [],
        (_, result) => resolve(result.rows._array.map((r) => ({ ...r, data: JSON.parse(r.data) }))),
        (_, error) => { reject(error); return true; }
      );
    });
  });
};

export default db;
