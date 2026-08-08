import { Router } from 'express';
import { getMaterials, updateMaterial, getAllInventory, getProjectInventory, stockIn, stockOut, getStockMovements, getMaterialCategories } from '../controllers/inventory.controller';
import { authenticate, authorize } from '../middleware/auth';
import { Role } from '@prisma/client';

const router = Router();
router.use(authenticate);

router.get('/materials', getMaterials);
router.put('/materials/:id', authorize(Role.SUPER_ADMIN), updateMaterial); // corrects unit/category typos only — cannot rename or create
router.get('/categories', getMaterialCategories);
router.get('/', getAllInventory);
router.get('/project/:projectId', getProjectInventory);
router.post('/stock-in', authorize(Role.SUPER_ADMIN, Role.PROJECT_MANAGER), stockIn);
router.post('/stock-out', authorize(Role.SUPER_ADMIN, Role.PROJECT_MANAGER), stockOut);
router.get('/movements', getStockMovements);

export default router;