import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

declare const process: {
  exit(code?: number): never;
};

const prisma = new PrismaClient();

const id = () => randomUUID();

async function main() {
  console.log('🌱 Starting database seed...');

  // Clean existing data in correct order
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.taskComment.deleteMany();
  await prisma.task.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.labourEntry.deleteMany();
  await prisma.dailyReport.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.salary.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.truckEntry.deleteMany();
  await prisma.machineryLog.deleteMany();
  await prisma.projectMachinery.deleteMany();
  await prisma.machinery.deleteMany();
  await prisma.pOItem.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.quotationItem.deleteMany();
  await prisma.quotation.deleteMany();
  await prisma.document.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.project.deleteMany();
  await prisma.material.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.worker.deleteMany();
  await prisma.contractor.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.user.deleteMany();

  console.log('✅ Cleaned existing data');

  const hash = await bcrypt.hash('Admin@123', 12);

  // ─── USERS ───────────────────────────────────────────────────
  const adminId = id();
  const pmId = id();
  const engineerId = id();
  const accountantId = id();
  const storekeeperID = id();

  const admin = await prisma.user.create({
    data: { id: adminId, firstName: 'Super', lastName: 'Admin', email: 'admin@erp.com', password: hash, role: 'SUPER_ADMIN', phone: '9999999999', isActive: true, createdAt: new Date(), updatedAt: new Date() },
  });
  const pm = await prisma.user.create({
    data: { id: pmId, firstName: 'Rajesh', lastName: 'Kumar', email: 'pm@erp.com', password: hash, role: 'PROJECT_MANAGER', phone: '9888888888', isActive: true, createdAt: new Date(), updatedAt: new Date() },
  });
  const engineer = await prisma.user.create({
    data: { id: engineerId, firstName: 'Priya', lastName: 'Singh', email: 'engineer@erp.com', password: hash, role: 'SITE_ENGINEER', phone: '9777777777', isActive: true, createdAt: new Date(), updatedAt: new Date() },
  });
  const accountant = await prisma.user.create({
    data: { id: accountantId, firstName: 'Amit', lastName: 'Sharma', email: 'accountant@erp.com', password: hash, role: 'ACCOUNTANT', phone: '9666666666', isActive: true, createdAt: new Date(), updatedAt: new Date() },
  });
  const storekeeper = await prisma.user.create({
    data: { id: storekeeperID, firstName: 'Vikram', lastName: 'Patel', email: 'store@erp.com', password: hash, role: 'STORE_KEEPER', phone: '9555555555', isActive: true, createdAt: new Date(), updatedAt: new Date() },
  });

  console.log('✅ Users created');

  // ─── VENDORS ─────────────────────────────────────────────────
  const vendor1 = await prisma.vendor.create({
    data: { id: id(), name: 'Ambuja Cement Co.', phone: '9111111111', email: 'sales@ambuja.com', category: 'Material Supplier', rating: 4.5, gstNumber: 'GST1234567890', address: 'Industrial Area, Ludhiana', isActive: true, createdAt: new Date(), updatedAt: new Date() },
  });
  const vendor2 = await prisma.vendor.create({
    data: { id: id(), name: 'JSW Steel Distributors', phone: '9222222222', email: 'orders@jsw.com', category: 'Steel Supplier', rating: 4.2, address: 'Steel Market, Mandi Gobindgarh', isActive: true, createdAt: new Date(), updatedAt: new Date() },
  });
  const vendor3 = await prisma.vendor.create({
    data: { id: id(), name: 'Punjab Transport Co.', phone: '9333333333', category: 'Transport', rating: 3.8, address: 'Transport Nagar, Ludhiana', isActive: true, createdAt: new Date(), updatedAt: new Date() },
  });
  const vendor4 = await prisma.vendor.create({
    data: { id: id(), name: 'Rathi Electricals', phone: '9444444444', email: 'rathi@electricals.com', category: 'Electrical', rating: 4.0, address: 'Model Town, Ludhiana', isActive: true, createdAt: new Date(), updatedAt: new Date() },
  });

  console.log('✅ Vendors created');

  // ─── MATERIALS ───────────────────────────────────────────────
  const cement    = await prisma.material.create({ data: { id: id(), name: 'Cement (50kg bag)', unit: 'bags', category: 'Binding Material', description: 'OPC 53 Grade' } });
  const steel     = await prisma.material.create({ data: { id: id(), name: 'Steel Rod (12mm)', unit: 'kg', category: 'Structural', description: 'Fe500 Grade TMT Bar' } });
  const sand      = await prisma.material.create({ data: { id: id(), name: 'River Sand', unit: 'cu.ft', category: 'Aggregate', description: 'Washed river sand' } });
  const bricks    = await prisma.material.create({ data: { id: id(), name: 'Red Bricks', unit: 'nos', category: 'Masonry', description: 'Standard size 9x4.5x3 inch' } });
  const aggregate = await prisma.material.create({ data: { id: id(), name: 'Coarse Aggregate (20mm)', unit: 'cu.ft', category: 'Aggregate', description: 'Crushed stone aggregate' } });
  const paint     = await prisma.material.create({ data: { id: id(), name: 'Exterior Paint', unit: 'liters', category: 'Finishing', description: 'Weather proof exterior paint' } });
  const plywood   = await prisma.material.create({ data: { id: id(), name: 'Plywood (18mm)', unit: 'sheets', category: 'Shuttering', description: 'BWR grade plywood' } });

  console.log('✅ Materials created');

  // ─── PROJECTS ────────────────────────────────────────────────
  const project1 = await prisma.project.create({
    data: {
      id: id(), projectCode: 'PRJ-2024-001', name: 'Green Valley Residential Complex',
      description: 'G+5 residential complex with 48 units, 2BHK and 3BHK apartments',
      clientName: 'Green Valley Developers Pvt. Ltd.', clientEmail: 'info@greenvalley.com', clientPhone: '9400000001',
      status: 'ACTIVE', budget: 25000000, progress: 42,
      startDate: new Date('2024-01-15'), endDate: new Date('2025-12-31'), location: 'Sector 12, Ludhiana',
      createdAt: new Date(), updatedAt: new Date(),
    },
  });
  const project2 = await prisma.project.create({
    data: {
      id: id(), projectCode: 'PRJ-2023-002', name: 'Highway Commercial Plaza',
      description: 'G+3 commercial plaza with retail shops and offices on NH-5',
      clientName: 'Singh Enterprises', clientEmail: 'contact@singhenterprises.com', clientPhone: '9400000002',
      status: 'ACTIVE', budget: 18000000, progress: 67,
      startDate: new Date('2023-08-01'), endDate: new Date('2025-06-30'), location: 'NH-5, Jalandhar Bypass',
      createdAt: new Date(), updatedAt: new Date(),
    },
  });
  const project3 = await prisma.project.create({
    data: {
      id: id(), projectCode: 'PRJ-2025-003', name: 'City Hospital Extension',
      description: 'New ICU wing and OPD extension for City Hospital',
      clientName: 'City Medical Trust', clientEmail: 'admin@cityhospital.com', clientPhone: '9400000003',
      status: 'PLANNING', budget: 35000000, progress: 8,
      startDate: new Date('2025-03-01'), endDate: new Date('2027-02-28'), location: 'Civil Lines, Ludhiana',
      createdAt: new Date(), updatedAt: new Date(),
    },
  });
  const project4 = await prisma.project.create({
    data: {
      id: id(), projectCode: 'PRJ-2023-004', name: 'Sunrise Township Phase 1',
      description: 'Plotted development with 120 plots and internal roads',
      clientName: 'Sunrise Realty', clientEmail: 'info@sunriserealty.com', clientPhone: '9400000004',
      status: 'COMPLETED', budget: 12000000, progress: 100,
      startDate: new Date('2022-06-01'), endDate: new Date('2024-05-31'), location: 'Pakhowal Road, Ludhiana',
      createdAt: new Date(), updatedAt: new Date(),
    },
  });

  console.log('✅ Projects created');

  // ─── PROJECT MEMBERS ─────────────────────────────────────────
  for (const m of [
    { projectId: project1.id, userId: admin.id, role: 'Project Director' },
    { projectId: project1.id, userId: pm.id, role: 'Project Manager' },
    { projectId: project1.id, userId: engineer.id, role: 'Site Engineer' },
    { projectId: project1.id, userId: storekeeper.id, role: 'Store Keeper' },
    { projectId: project2.id, userId: admin.id, role: 'Project Director' },
    { projectId: project2.id, userId: pm.id, role: 'Project Manager' },
    { projectId: project2.id, userId: engineer.id, role: 'Site Engineer' },
    { projectId: project2.id, userId: accountant.id, role: 'Accountant' },
    { projectId: project3.id, userId: admin.id, role: 'Project Director' },
    { projectId: project3.id, userId: pm.id, role: 'Project Manager' },
    { projectId: project4.id, userId: admin.id, role: 'Project Director' },
    { projectId: project4.id, userId: accountant.id, role: 'Accountant' },
  ]) {
    await prisma.projectMember.create({ data: { id: id(), ...m } });
  }

  console.log('✅ Project members added');

  // ─── EXPENSES ────────────────────────────────────────────────
  const expenseData = [
    { title: 'Cement Purchase - Jan', amount: 95000, category: 'Materials', status: 'APPROVED', projectId: project1.id, userId: pm.id, vendorName: 'Ambuja Cement Co.', invoiceNo: 'INV-2025-001', expenseDate: new Date('2025-01-10'), approvedBy: admin.id, approvedAt: new Date('2025-01-11') },
    { title: 'Steel Rods - Jan', amount: 354000, category: 'Materials', status: 'APPROVED', projectId: project1.id, userId: pm.id, vendorName: 'JSW Steel Distributors', invoiceNo: 'INV-2025-002', expenseDate: new Date('2025-01-15'), approvedBy: admin.id, approvedAt: new Date('2025-01-16') },
    { title: 'Labour Wages - January', amount: 180000, category: 'Labour', status: 'APPROVED', projectId: project1.id, userId: pm.id, expenseDate: new Date('2025-01-31'), approvedBy: admin.id, approvedAt: new Date('2025-02-01') },
    { title: 'Cement Purchase - Feb', amount: 114000, category: 'Materials', status: 'APPROVED', projectId: project1.id, userId: engineer.id, vendorName: 'Ambuja Cement Co.', expenseDate: new Date('2025-02-08'), approvedBy: admin.id, approvedAt: new Date('2025-02-09') },
    { title: 'Aggregate Purchase', amount: 67000, category: 'Materials', status: 'APPROVED', projectId: project1.id, userId: engineer.id, vendorName: 'Punjab Transport Co.', expenseDate: new Date('2025-02-14'), approvedBy: admin.id, approvedAt: new Date('2025-02-15') },
    { title: 'Labour Wages - February', amount: 195000, category: 'Labour', status: 'APPROVED', projectId: project1.id, userId: pm.id, expenseDate: new Date('2025-02-28'), approvedBy: admin.id, approvedAt: new Date('2025-03-01') },
    { title: 'Crane Rental - March', amount: 85000, category: 'Equipment', status: 'APPROVED', projectId: project1.id, userId: pm.id, expenseDate: new Date('2025-03-05'), approvedBy: admin.id, approvedAt: new Date('2025-03-06') },
    { title: 'Labour Wages - March', amount: 210000, category: 'Labour', status: 'APPROVED', projectId: project1.id, userId: pm.id, expenseDate: new Date('2025-03-31'), approvedBy: admin.id, approvedAt: new Date('2025-04-01') },
    { title: 'Cement Purchase - Apr', amount: 104500, category: 'Materials', status: 'APPROVED', projectId: project1.id, userId: engineer.id, vendorName: 'Ambuja Cement Co.', expenseDate: new Date('2025-04-07'), approvedBy: admin.id, approvedAt: new Date('2025-04-08') },
    { title: 'Steel Purchase - Apr', amount: 278000, category: 'Materials', status: 'APPROVED', projectId: project1.id, userId: pm.id, vendorName: 'JSW Steel Distributors', expenseDate: new Date('2025-04-12'), approvedBy: admin.id, approvedAt: new Date('2025-04-13') },
    { title: 'Labour Wages - April', amount: 225000, category: 'Labour', status: 'APPROVED', projectId: project1.id, userId: pm.id, expenseDate: new Date('2025-04-30'), approvedBy: admin.id, approvedAt: new Date('2025-05-01') },
    { title: 'Safety Equipment', amount: 28000, category: 'Safety', status: 'APPROVED', projectId: project1.id, userId: engineer.id, expenseDate: new Date('2025-05-03'), approvedBy: admin.id, approvedAt: new Date('2025-05-04') },
    { title: 'Electrical Wiring Materials', amount: 67500, category: 'Materials', status: 'PENDING', projectId: project1.id, userId: engineer.id, vendorName: 'Rathi Electricals', invoiceNo: 'INV-2025-089', expenseDate: new Date('2025-05-15') },
    { title: 'Diesel for Generator', amount: 12500, category: 'Utilities', status: 'PENDING', projectId: project1.id, userId: engineer.id, expenseDate: new Date('2025-05-18') },
    { title: 'Paint & Finishing Materials', amount: 54000, category: 'Materials', status: 'REJECTED', projectId: project1.id, userId: engineer.id, expenseDate: new Date('2025-05-10'), rejectedReason: 'Wrong vendor — please resubmit with approved vendor' },
    { title: 'Foundation Concrete', amount: 320000, category: 'Materials', status: 'APPROVED', projectId: project2.id, userId: pm.id, expenseDate: new Date('2025-01-20'), approvedBy: admin.id, approvedAt: new Date('2025-01-21') },
    { title: 'Labour Wages - Jan (Site 2)', amount: 145000, category: 'Labour', status: 'APPROVED', projectId: project2.id, userId: pm.id, expenseDate: new Date('2025-01-31'), approvedBy: admin.id, approvedAt: new Date('2025-02-01') },
    { title: 'Equipment Rental', amount: 95000, category: 'Equipment', status: 'APPROVED', projectId: project2.id, userId: pm.id, expenseDate: new Date('2025-02-10'), approvedBy: admin.id, approvedAt: new Date('2025-02-11') },
    { title: 'Bricks Purchase', amount: 88000, category: 'Materials', status: 'APPROVED', projectId: project2.id, userId: engineer.id, expenseDate: new Date('2025-03-08'), approvedBy: admin.id, approvedAt: new Date('2025-03-09') },
    { title: 'Labour Wages - March (Site 2)', amount: 167000, category: 'Labour', status: 'APPROVED', projectId: project2.id, userId: pm.id, expenseDate: new Date('2025-03-31'), approvedBy: admin.id, approvedAt: new Date('2025-04-01') },
    { title: 'Waterproofing Treatment', amount: 42000, category: 'Materials', status: 'PENDING', projectId: project2.id, userId: engineer.id, expenseDate: new Date('2025-05-12') },
  ];

  for (const e of expenseData) {
    await prisma.expense.create({ data: { id: id(), updatedAt: new Date(), ...(e as any) } as any });
  }

  console.log('✅ Expenses created');

  // ─── WORKERS ─────────────────────────────────────────────────
  const worker1 = await prisma.worker.create({ data: { id: id(), name: 'Ramu Lal', phone: '9500001111', skill: 'Mason', dailyWage: 800, aadharNo: '1234-5678-9012', isActive: true, joinDate: new Date('2024-01-20') } });
  const worker2 = await prisma.worker.create({ data: { id: id(), name: 'Shyam Singh', phone: '9500002222', skill: 'Carpenter', dailyWage: 750, isActive: true, joinDate: new Date('2024-01-20') } });
  const worker3 = await prisma.worker.create({ data: { id: id(), name: 'Ganesh Yadav', phone: '9500003333', skill: 'Electrician', dailyWage: 900, isActive: true, joinDate: new Date('2024-02-01') } });
  const worker4 = await prisma.worker.create({ data: { id: id(), name: 'Mohan Patel', phone: '9500004444', skill: 'Helper', dailyWage: 550, isActive: true, joinDate: new Date('2024-02-15') } });
  const worker5 = await prisma.worker.create({ data: { id: id(), name: 'Suresh Kumar', phone: '9500005555', skill: 'Plumber', dailyWage: 850, isActive: true, joinDate: new Date('2024-03-01') } });
  const worker6 = await prisma.worker.create({ data: { id: id(), name: 'Deepak Verma', phone: '9500006666', skill: 'Welder', dailyWage: 950, isActive: true, joinDate: new Date('2024-03-10') } });
  const worker7 = await prisma.worker.create({ data: { id: id(), name: 'Harpreet Kaur', phone: '9500007777', skill: 'Helper', dailyWage: 500, isActive: true, joinDate: new Date('2024-04-01') } });

  console.log('✅ Workers created');

  // ─── CONTRACTORS ─────────────────────────────────────────────
  const contractor1 = await prisma.contractor.create({ data: { id: id(), name: 'Harminder Singh', company: 'HS Electricals', phone: '9600001111', email: 'hs@electricals.com', specialty: 'Electrical', ratePerDay: 5000, isActive: true } });
  const contractor2 = await prisma.contractor.create({ data: { id: id(), name: 'Baldev & Sons', company: 'Baldev Plumbing Works', phone: '9600002222', specialty: 'Plumbing', ratePerDay: 4500, isActive: true } });
  const contractor3 = await prisma.contractor.create({ data: { id: id(), name: 'Gurpreet Masonry', company: 'GP Construction', phone: '9600003333', specialty: 'Masonry', ratePerDay: 6000, isActive: true } });

  console.log('✅ Contractors created');

  // ─── ATTENDANCE ───────────────────────────────────────────────
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);

  for (const a of [
    { workerId: worker1.id, date: today, present: true, hoursWorked: 8, overtime: 1 },
    { workerId: worker2.id, date: today, present: true, hoursWorked: 8, overtime: 0 },
    { workerId: worker3.id, date: today, present: false, hoursWorked: 0, overtime: 0 },
    { workerId: worker4.id, date: today, present: true, hoursWorked: 8, overtime: 2 },
    { workerId: worker5.id, date: today, present: true, hoursWorked: 8, overtime: 0 },
    { workerId: worker1.id, date: yesterday, present: true, hoursWorked: 8, overtime: 0 },
    { workerId: worker2.id, date: yesterday, present: true, hoursWorked: 8, overtime: 1 },
    { contractorId: contractor1.id, date: today, present: true, hoursWorked: 8, overtime: 0 },
    { contractorId: contractor2.id, date: today, present: true, hoursWorked: 8, overtime: 0 },
  ]) {
    await prisma.attendance.create({ data: { id: id(), ...a } });
  }

  console.log('✅ Attendance marked');

  // ─── MACHINERY ───────────────────────────────────────────────
  const jcb   = await prisma.machinery.create({ data: { id: id(), name: 'JCB 3DX Backhoe Loader', type: 'Earth Moving', make: 'JCB', model: '3DX', regNumber: 'PB10-JCB-001', status: 'ACTIVE', hourlyRate: 1200, purchasePrice: 2800000, purchaseDate: new Date('2022-03-15'), updatedAt: new Date() } });
  const crane = await prisma.machinery.create({ data: { id: id(), name: 'Tower Crane TC5013', type: 'Lifting', make: 'Liebherr', model: 'TC5013', status: 'ACTIVE', hourlyRate: 2500, purchasePrice: 8500000, updatedAt: new Date() } });
  const mixer = await prisma.machinery.create({ data: { id: id(), name: 'Concrete Mixer 10/7', type: 'Mixing', make: 'Ajax', model: 'CM-107', status: 'ACTIVE', hourlyRate: 400, purchasePrice: 180000, updatedAt: new Date() } });
  const roller= await prisma.machinery.create({ data: { id: id(), name: 'Road Roller 8T', type: 'Compaction', make: 'WIRTGEN', model: 'W8', status: 'MAINTENANCE', hourlyRate: 800, purchasePrice: 1200000, updatedAt: new Date() } });

  for (const m of [
    { projectId: project1.id, machineryId: jcb.id, startDate: new Date('2024-01-20') },
    { projectId: project1.id, machineryId: crane.id, startDate: new Date('2024-02-01') },
    { projectId: project1.id, machineryId: mixer.id, startDate: new Date('2024-01-20') },
    { projectId: project2.id, machineryId: jcb.id, startDate: new Date('2023-08-15') },
  ]) {
    await prisma.projectMachinery.create({ data: { id: id(), ...m } });
  }

  for (const l of [
    { machineryId: jcb.id, logDate: new Date('2025-05-15'), hoursUsed: 8, fuelUsed: 45, operatorName: 'Gurmail Singh', workDone: 'Foundation excavation Block C' },
    { machineryId: jcb.id, logDate: new Date('2025-05-16'), hoursUsed: 7.5, fuelUsed: 42, operatorName: 'Gurmail Singh', workDone: 'Trench digging for drainage' },
    { machineryId: crane.id, logDate: new Date('2025-05-15'), hoursUsed: 6, operatorName: 'Balkar Singh', workDone: 'Steel beam lifting Floor 4' },
    { machineryId: mixer.id, logDate: new Date('2025-05-15'), hoursUsed: 10, fuelUsed: 12, operatorName: 'Mohan', workDone: 'Concrete mixing for columns' },
    { machineryId: mixer.id, logDate: new Date('2025-05-16'), hoursUsed: 9, fuelUsed: 11, operatorName: 'Mohan', workDone: 'Slab concrete mixing' },
  ]) {
    await prisma.machineryLog.create({ data: { id: id(), ...l } });
  }

  console.log('✅ Machinery created');

  // ─── INVENTORY ───────────────────────────────────────────────
  const inv1 = await prisma.inventoryItem.create({ data: { id: id(), projectId: project1.id, materialId: cement.id, quantity: 250, minStock: 50, unitPrice: 380, location: 'Store A', updatedAt: new Date() } });
  const inv2 = await prisma.inventoryItem.create({ data: { id: id(), projectId: project1.id, materialId: steel.id, quantity: 5200, minStock: 1000, unitPrice: 68, location: 'Yard', updatedAt: new Date() } });
  const inv3 = await prisma.inventoryItem.create({ data: { id: id(), projectId: project1.id, materialId: sand.id, quantity: 800, minStock: 200, unitPrice: 35, location: 'Yard', updatedAt: new Date() } });
  const inv4 = await prisma.inventoryItem.create({ data: { id: id(), projectId: project1.id, materialId: bricks.id, quantity: 12000, minStock: 2000, unitPrice: 8, location: 'Yard', updatedAt: new Date() } });
  const inv5 = await prisma.inventoryItem.create({ data: { id: id(), projectId: project1.id, materialId: aggregate.id, quantity: 30, minStock: 50, unitPrice: 45, location: 'Yard', updatedAt: new Date() } });
  const inv6 = await prisma.inventoryItem.create({ data: { id: id(), projectId: project2.id, materialId: cement.id, quantity: 180, minStock: 50, unitPrice: 385, location: 'Store B', updatedAt: new Date() } });
  const inv7 = await prisma.inventoryItem.create({ data: { id: id(), projectId: project2.id, materialId: steel.id, quantity: 3800, minStock: 500, unitPrice: 69, location: 'Yard B', updatedAt: new Date() } });

  for (const m of [
    { inventoryItemId: inv1.id, movementType: 'IN' as const, quantity: 300, unitPrice: 380, reference: 'PO-001', notes: 'Initial stock' },
    { inventoryItemId: inv1.id, movementType: 'OUT' as const, quantity: 50, notes: 'Used for Floor 3 columns' },
    { inventoryItemId: inv2.id, movementType: 'IN' as const, quantity: 6000, unitPrice: 68, reference: 'PO-002', notes: 'Initial stock' },
    { inventoryItemId: inv2.id, movementType: 'OUT' as const, quantity: 800, notes: 'Used for slabs' },
    { inventoryItemId: inv3.id, movementType: 'IN' as const, quantity: 1000, unitPrice: 35, notes: 'Sand delivery' },
    { inventoryItemId: inv3.id, movementType: 'OUT' as const, quantity: 200, notes: 'Used for plastering' },
    { inventoryItemId: inv4.id, movementType: 'IN' as const, quantity: 15000, unitPrice: 8, notes: 'Brick delivery batch 1' },
    { inventoryItemId: inv4.id, movementType: 'OUT' as const, quantity: 3000, notes: 'Used for walls Floor 1-2' },
  ]) {
    await prisma.stockMovement.create({ data: { id: id(), ...m } });
  }

  console.log('✅ Inventory created');

  // ─── DAILY REPORTS ───────────────────────────────────────────
  const report1 = await prisma.dailyReport.create({
    data: {
      id: id(), projectId: project1.id, userId: engineer.id,
      reportDate: new Date('2025-05-16'), weather: 'Sunny', temperature: 36,
      summary: 'Column casting on Floor 4 completed. Shuttering removed from Floor 3.',
      workDone: 'Completed 6 columns on floor 4 using M25 concrete. Removed shuttering from 8 columns on floor 3.',
      issuesFound: 'Minor water leakage in column C-12, grouting done.',
      safetyNotes: 'All workers with helmets and safety shoes. Safety net installed on floor 4.',
      labourCount: 52, progress: 44,
      updatedAt: new Date(),
    },
  });

  for (const l of [
    { reportId: report1.id, labourType: 'SKILLED' as const, count: 18, hoursWorked: 8, workDescription: 'Column casting and shuttering' },
    { reportId: report1.id, labourType: 'UNSKILLED' as const, count: 30, hoursWorked: 8, workDescription: 'Material handling and mixing' },
    { reportId: report1.id, labourType: 'SUPERVISOR' as const, count: 4, hoursWorked: 9, workDescription: 'Site supervision' },
  ]) {
    await prisma.labourEntry.create({ data: { id: id(), ...l } });
  }

  const report2 = await prisma.dailyReport.create({
    data: {
      id: id(), projectId: project1.id, userId: engineer.id,
      reportDate: new Date('2025-05-15'), weather: 'Partly Cloudy', temperature: 33,
      summary: 'Slab casting for Floor 3 completed successfully.',
      workDone: 'Full slab casting done for floor 3 (1800 sq ft). Concrete curing started.',
      labourCount: 58, progress: 43,
      updatedAt: new Date(),
    },
  });

  for (const l of [
    { reportId: report2.id, labourType: 'SKILLED' as const, count: 20, hoursWorked: 10, workDescription: 'Slab casting' },
    { reportId: report2.id, labourType: 'UNSKILLED' as const, count: 35, hoursWorked: 10, workDescription: 'Concrete pouring and compaction' },
    { reportId: report2.id, labourType: 'SUPERVISOR' as const, count: 3, hoursWorked: 10, workDescription: 'Quality supervision' },
  ]) {
    await prisma.labourEntry.create({ data: { id: id(), ...l } });
  }

  const report3 = await prisma.dailyReport.create({
    data: {
      id: id(), projectId: project2.id, userId: engineer.id,
      reportDate: new Date('2025-05-16'), weather: 'Hot', temperature: 39,
      summary: 'External plastering on south wing completed.',
      workDone: 'External plastering completed on south wing. Internal plastering started on east wing.',
      safetyNotes: 'Heat wave conditions — extra water breaks every hour.',
      labourCount: 38, progress: 68,
      updatedAt: new Date(),
    },
  });

  for (const l of [
    { reportId: report3.id, labourType: 'SKILLED' as const, count: 22, hoursWorked: 8, workDescription: 'Plastering work' },
    { reportId: report3.id, labourType: 'UNSKILLED' as const, count: 14, hoursWorked: 8, workDescription: 'Material preparation' },
    { reportId: report3.id, labourType: 'SUPERVISOR' as const, count: 2, hoursWorked: 8, workDescription: 'Quality check' },
  ]) {
    await prisma.labourEntry.create({ data: { id: id(), ...l } });
  }

  console.log('✅ Daily reports created');

  // ─── PURCHASE ORDERS ─────────────────────────────────────────
  const po1 = await prisma.purchaseOrder.create({
    data: { id: id(), poNumber: 'PO-2025-001', projectId: project1.id, vendorId: vendor1.id, status: 'APPROVED', totalAmount: 190000, deliveryDate: new Date('2025-02-15'), notes: 'Urgent order for floor 3 casting', updatedAt: new Date() },
  });
  await prisma.pOItem.create({ data: { id: id(), poId: po1.id, materialId: cement.id, quantity: 500, unitPrice: 380, totalPrice: 190000, receivedQty: 500 } });

  const po2 = await prisma.purchaseOrder.create({
    data: { id: id(), poNumber: 'PO-2025-002', projectId: project1.id, vendorId: vendor2.id, status: 'RECEIVED', totalAmount: 408000, deliveryDate: new Date('2025-03-01'), receivedAt: new Date('2025-03-01'), updatedAt: new Date() },
  });
  await prisma.pOItem.create({ data: { id: id(), poId: po2.id, materialId: steel.id, quantity: 6000, unitPrice: 68, totalPrice: 408000, receivedQty: 6000 } });

  const po3 = await prisma.purchaseOrder.create({
    data: { id: id(), poNumber: 'PO-2025-003', projectId: project1.id, vendorId: vendor1.id, status: 'SUBMITTED', totalAmount: 209000, deliveryDate: new Date('2025-06-01'), notes: 'For floor 5 & 6 work', updatedAt: new Date() },
  });
  await prisma.pOItem.create({ data: { id: id(), poId: po3.id, materialId: cement.id, quantity: 550, unitPrice: 380, totalPrice: 209000, receivedQty: 0 } });

  // ✅ Fixed: po4 now has vendorId (was missing before)
  const po4 = await prisma.purchaseOrder.create({
    data: { id: id(), poNumber: 'PO-2025-004', projectId: project2.id, vendorId: vendor4.id, status: 'DRAFT', totalAmount: 125000, notes: 'Electrical materials for ground floor', updatedAt: new Date() },
  });

  console.log('✅ Purchase orders created');

  // ─── QUOTATIONS ──────────────────────────────────────────────
  const q1 = await prisma.quotation.create({
    data: { id: id(), quotationNo: 'QT-2025-001', projectId: project1.id, vendorId: vendor2.id, status: 'ACCEPTED', totalAmount: 544000, validUntil: new Date('2025-06-30'), terms: 'Payment within 30 days of delivery. GST extra.', notes: 'For remaining steel requirement', updatedAt: new Date() },
  });
  await prisma.quotationItem.create({ data: { id: id(), quotationId: q1.id, materialId: steel.id, quantity: 8000, unitPrice: 68, totalPrice: 544000 } });

  const q2 = await prisma.quotation.create({
    data: { id: id(), quotationNo: 'QT-2025-002', projectId: project1.id, vendorId: vendor4.id, status: 'SENT', totalAmount: 285000, validUntil: new Date('2025-06-15'), notes: 'Full building electrical wiring', updatedAt: new Date() },
  });

  console.log('✅ Quotations created');

// ─── TRUCK ENTRIES ───────────────────────────────────────────
for (const t of [
  { projectId: project1.id, vendorId: vendor3.id, vehicleNo: 'PB10-CA-1234', driverName: 'Gurjit Singh', material: 'River Sand', slipNo: 'SLIP-001', notes: '22.5 MT gross, 10.2 MT tare, 12.3 MT net' },
  { projectId: project1.id, vendorId: vendor3.id, vehicleNo: 'PB10-CB-5678', driverName: 'Balwinder', material: 'Coarse Aggregate', slipNo: 'SLIP-002', notes: '21.8 MT gross, 10.0 MT tare, 11.8 MT net' },
  { projectId: project1.id, vehicleNo: 'PB10-CC-9012', driverName: 'Sukhdev', material: 'River Sand', slipNo: 'SLIP-003', notes: '23.2 MT gross, 10.5 MT tare, 12.7 MT net' },
  { projectId: project2.id, vendorId: vendor3.id, vehicleNo: 'PB08-DA-4321', driverName: 'Ranjit Kumar', material: 'Cement Bags', slipNo: 'SLIP-004', notes: '18.5 MT gross, 8.2 MT tare, 10.3 MT net' },
  { projectId: project1.id, vehicleNo: 'PB10-CE-3456', driverName: 'Harbhajan', material: 'Steel Rods', slipNo: 'SLIP-005', notes: '25.0 MT gross, 10.8 MT tare, 14.2 MT net' },
]) {
  await prisma.truckEntry.create({ data: { id: id(), ...t } });
}

console.log('✅ Truck entries created');

  // ─── TASKS ───────────────────────────────────────────────────
  for (const t of [
    { title: 'Foundation excavation & PCC', status: 'DONE', priority: 'HIGH', projectId: project1.id, assigneeId: engineer.id, completedAt: new Date('2024-03-15') },
    { title: 'Footing & Column Base', status: 'DONE', priority: 'HIGH', projectId: project1.id, assigneeId: engineer.id, completedAt: new Date('2024-05-20') },
    { title: 'Ground floor slab', status: 'DONE', priority: 'HIGH', projectId: project1.id, assigneeId: engineer.id, completedAt: new Date('2024-09-30') },
    { title: 'Floor 3 slab casting', status: 'DONE', priority: 'HIGH', projectId: project1.id, assigneeId: engineer.id, completedAt: new Date('2025-05-15') },
    { title: 'Floor 4 column casting', status: 'IN_PROGRESS', priority: 'HIGH', projectId: project1.id, assigneeId: engineer.id, dueDate: new Date('2025-06-15') },
    { title: 'Floor 4 beam & slab casting', status: 'TODO', priority: 'HIGH', projectId: project1.id, assigneeId: pm.id, dueDate: new Date('2025-07-30') },
    { title: 'Electrical rough-in (all floors)', status: 'TODO', priority: 'MEDIUM', projectId: project1.id, assigneeId: pm.id, dueDate: new Date('2025-08-15') },
    { title: 'Plumbing rough-in', status: 'TODO', priority: 'MEDIUM', projectId: project1.id, dueDate: new Date('2025-08-30') },
    { title: 'Safety audit Q2 2025', status: 'TODO', priority: 'CRITICAL', projectId: project1.id, assigneeId: pm.id, dueDate: new Date('2025-06-01') },
    { title: 'Procurement plan for finishing', status: 'REVIEW', priority: 'MEDIUM', projectId: project1.id, assigneeId: accountant.id, dueDate: new Date('2025-06-10') },
    { title: 'External scaffolding', status: 'BLOCKED', priority: 'HIGH', projectId: project1.id, description: 'Blocked — waiting for municipality approval', dueDate: new Date('2025-09-30') },
    { title: 'External plastering south wing', status: 'DONE', priority: 'HIGH', projectId: project2.id, assigneeId: engineer.id, completedAt: new Date('2025-05-16') },
    { title: 'Internal plastering', status: 'IN_PROGRESS', priority: 'HIGH', projectId: project2.id, assigneeId: engineer.id, dueDate: new Date('2025-06-30') },
    { title: 'Tile fixing ground floor', status: 'REVIEW', priority: 'MEDIUM', projectId: project2.id, dueDate: new Date('2025-07-15') },
    { title: 'Electrical finishing', status: 'TODO', priority: 'HIGH', projectId: project2.id, dueDate: new Date('2025-08-01') },
  ]) {
    await prisma.task.create({ data: { id: id(), updatedAt: new Date(), ...(t as any) } as any });
  }

  console.log('✅ Tasks created');

  // ─── SALARY ──────────────────────────────────────────────────
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;

  for (const s of [
    { userId: pm.id, projectId: project1.id, month: prevMonth, year: prevYear, basicSalary: 65000, overtime: 5000, deductions: 3000, netSalary: 67000, status: 'PAID', paidAt: new Date() },
    { userId: engineer.id, projectId: project1.id, month: prevMonth, year: prevYear, basicSalary: 45000, overtime: 3500, deductions: 2000, netSalary: 46500, status: 'PAID', paidAt: new Date() },
    { userId: accountant.id, month: prevMonth, year: prevYear, basicSalary: 40000, overtime: 0, deductions: 1500, netSalary: 38500, status: 'PAID', paidAt: new Date() },
    { workerId: worker1.id, projectId: project1.id, month: prevMonth, year: prevYear, basicSalary: 20800, overtime: 1600, deductions: 0, netSalary: 22400, status: 'PAID', paidAt: new Date() },
    { workerId: worker2.id, projectId: project1.id, month: prevMonth, year: prevYear, basicSalary: 19500, overtime: 0, deductions: 0, netSalary: 19500, status: 'PAID', paidAt: new Date() },
    { userId: pm.id, projectId: project1.id, month: currentMonth, year: currentYear, basicSalary: 65000, overtime: 0, deductions: 3000, netSalary: 62000, status: 'PENDING' },
    { userId: engineer.id, projectId: project1.id, month: currentMonth, year: currentYear, basicSalary: 45000, overtime: 0, deductions: 2000, netSalary: 43000, status: 'PENDING' },
    { userId: accountant.id, month: currentMonth, year: currentYear, basicSalary: 40000, overtime: 0, deductions: 1500, netSalary: 38500, status: 'PENDING' },
    { workerId: worker1.id, projectId: project1.id, month: currentMonth, year: currentYear, basicSalary: 20800, overtime: 800, deductions: 0, netSalary: 21600, status: 'PROCESSED' },
    { workerId: worker2.id, projectId: project1.id, month: currentMonth, year: currentYear, basicSalary: 19500, overtime: 750, deductions: 0, netSalary: 20250, status: 'PENDING' },
  ]) {
    await prisma.salary.create({ data: { id: id(), ...(s as any) } as any });
  }

  console.log('✅ Salary records created');

  // ─── NOTIFICATIONS ───────────────────────────────────────────
  for (const n of [
    { userId: admin.id, title: 'New Expense Submitted', message: 'Priya Singh submitted: Electrical Wiring Materials — ₹67,500', type: 'expense', isRead: false, link: '/expenses' },
    { userId: admin.id, title: 'Low Stock Alert', message: 'Coarse Aggregate is running low (30 cu.ft, min: 50)', type: 'warning', isRead: false, link: '/inventory' },
    { userId: admin.id, title: 'New Expense Submitted', message: 'Priya Singh submitted: Diesel for Generator — ₹12,500', type: 'expense', isRead: false, link: '/expenses' },
    { userId: admin.id, title: 'Purchase Order Submitted', message: 'PO-2025-003 submitted for approval — ₹2,09,000', type: 'info', isRead: true, link: '/purchase-orders' },
    { userId: pm.id, title: 'Task Due Soon', message: 'Safety audit Q2 2025 is due on June 1, 2025', type: 'warning', isRead: false, link: '/tasks' },
    { userId: engineer.id, title: 'Expense Approved', message: 'Your expense "Safety Equipment" has been approved.', type: 'success', isRead: true, link: '/expenses' },
    { userId: engineer.id, title: 'Expense Rejected', message: 'Your expense "Paint & Finishing Materials" was rejected. Wrong vendor.', type: 'error', isRead: false, link: '/expenses' },
    { userId: accountant.id, title: 'Salary Processing Due', message: 'Current month salaries are pending processing', type: 'info', isRead: false, link: '/salary' },
  ]) {
    await prisma.notification.create({ data: { id: id(), ...n } });
  }

  console.log('✅ Notifications created');

  // ─── AUDIT LOGS ──────────────────────────────────────────────
  for (const a of [
    { userId: admin.id, action: 'CREATE', module: 'project', entityType: 'Project', entityId: project1.id, newValues: { name: 'Green Valley Residential Complex' }, ipAddress: '192.168.1.1' },
    { userId: admin.id, action: 'CREATE', module: 'project', entityType: 'Project', entityId: project2.id, newValues: { name: 'Highway Commercial Plaza' }, ipAddress: '192.168.1.1' },
    { userId: pm.id, action: 'CREATE', module: 'expense', entityType: 'Expense', newValues: { title: 'Cement Purchase', amount: 95000 }, ipAddress: '192.168.1.2' },
    { userId: admin.id, action: 'APPROVE', module: 'expense', entityType: 'Expense', newValues: { status: 'APPROVED' }, ipAddress: '192.168.1.1' },
    { userId: admin.id, action: 'CREATE', module: 'purchase-order', entityType: 'PurchaseOrder', newValues: { poNumber: 'PO-2025-001' }, ipAddress: '192.168.1.1' },
    { userId: engineer.id, action: 'CREATE', module: 'report', entityType: 'DailyReport', newValues: { date: '2025-05-16', labourCount: 52 }, ipAddress: '192.168.1.3' },
    { userId: admin.id, action: 'UPDATE', module: 'project', entityType: 'Project', entityId: project1.id, oldValues: { progress: 38 }, newValues: { progress: 42 }, ipAddress: '192.168.1.1' },
  ]) {
    await prisma.auditLog.create({ data: { id: id(), ...a } });
  }

  console.log('✅ Audit logs created');

  console.log('\n🎉 Database seed completed successfully!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Login credentials:');
  console.log('  Super Admin  → admin@erp.com / Admin@123');
  console.log('  Project Mgr  → pm@erp.com / Admin@123');
  console.log('  Site Eng     → engineer@erp.com / Admin@123');
  console.log('  Accountant   → accountant@erp.com / Admin@123');
  console.log('  Store Keeper → store@erp.com / Admin@123');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main()
  .catch((e) => { console.error('❌ Seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
