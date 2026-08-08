import { Express } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './users.routes';
import projectRoutes from './projects.routes';
import expenseRoutes from './expenses.routes';
import dailyReportRoutes from './dailyReports.routes';
import inventoryRoutes from './inventory.routes';
import truckEntryRoutes from './truckEntries.routes';
import machineryRoutes from './machinery.routes';
import vendorRoutes from './vendors.routes';
import purchaseOrderRoutes from './purchaseOrders.routes';
import taskRoutes from './tasks.routes';
import analyticsRoutes from './analytics.routes';
import documentRoutes from './documents.routes';
import notificationRoutes from './notifications.routes';
import clientRoutes from './clients.routes';
import labourRoutes from './labour.routes';
import salaryRoutes from './salary.routes';
import auditLogRoutes from './auditLogs.routes';
import quotationRoutes from './quotations.routes';
import uploadsRoutes from './uploads.routes';
import documentCategoriesRoutes from './documentCategories.routes';
import taskTypesRoutes from './taskTypes.routes';
import taskDailyLogsRoutes from './taskDailyLogs.routes';

export const setupRoutes = (app: Express): void => {
  const API_PREFIX = '/api/v1';

  app.use(`${API_PREFIX}/auth`, authRoutes);
  app.use(`${API_PREFIX}/users`, userRoutes);
  app.use(`${API_PREFIX}/projects`, projectRoutes);
  app.use(`${API_PREFIX}/expenses`, expenseRoutes);
  app.use(`${API_PREFIX}/daily-reports`, dailyReportRoutes);
  app.use(`${API_PREFIX}/inventory`, inventoryRoutes);
  app.use(`${API_PREFIX}/truck-entries`, truckEntryRoutes);
  app.use(`${API_PREFIX}/machinery`, machineryRoutes);
  app.use(`${API_PREFIX}/vendors`, vendorRoutes);
  app.use(`${API_PREFIX}/purchase-orders`, purchaseOrderRoutes);
  app.use(`${API_PREFIX}/tasks`, taskRoutes);
  app.use(`${API_PREFIX}/analytics`, analyticsRoutes);
  app.use(`${API_PREFIX}/documents`, documentRoutes);
  app.use(`${API_PREFIX}/notifications`, notificationRoutes);
  app.use(`${API_PREFIX}/clients`, clientRoutes);
  app.use(`${API_PREFIX}/labour`, labourRoutes);
  app.use(`${API_PREFIX}/salary`, salaryRoutes);
  app.use(`${API_PREFIX}/audit-logs`, auditLogRoutes);
  app.use(`${API_PREFIX}/quotations`, quotationRoutes);
  app.use(`${API_PREFIX}/uploads`, uploadsRoutes);
  app.use(`${API_PREFIX}/document-categories`, documentCategoriesRoutes);
  app.use(`${API_PREFIX}/task-types`, taskTypesRoutes);
  app.use(`${API_PREFIX}/task-daily-logs`, taskDailyLogsRoutes);

  // API docs endpoint
  app.get(`${API_PREFIX}/docs`, (req, res) => {
    res.json({
      title: 'Construction ERP API',
      version: '1.0.0',
      baseUrl: `${req.protocol}://${req.get('host')}${API_PREFIX}`,
      endpoints: {
        auth: '/auth - Authentication endpoints',
        users: '/users - User management',
        projects: '/projects - Project management',
        expenses: '/expenses - Expense management',
        dailyReports: '/daily-reports - Daily progress reports',
        inventory: '/inventory - Inventory management',
        truckEntries: '/truck-entries - Truck entry management',
        machinery: '/machinery - Machinery management',
        vendors: '/vendors - Vendor management',
        purchaseOrders: '/purchase-orders - Purchase order management',
        tasks: '/tasks - Task management',
        analytics: '/analytics - Analytics & reports',
        documents: '/documents - Document management',
        notifications: '/notifications - Notifications',
        clients: '/clients - Client management',
        labour: '/labour - Labour management',
        salary: '/salary - Salary management',
        auditLogs: '/audit-logs - Audit trail',
        quotations: '/quotations - Quotation management',
        uploads: '/uploads - File uploads (receipts, documents)',
        documentCategories: '/document-categories - Dynamic document type categories',
      },
    });
  });
};