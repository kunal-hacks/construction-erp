import { Router } from 'express';
import { getPurchaseOrders, getPurchaseOrderById, createPurchaseOrder, approvePurchaseOrder, submitPurchaseOrder, recordGoodsReceipt } from '../controllers/purchaseOrders.controller';
import { authenticate, authorize } from '../middleware/auth';
import { Role } from '@prisma/client';

const router = Router();
router.use(authenticate);

router.get('/', getPurchaseOrders);
router.get('/:id', getPurchaseOrderById);
router.post('/', createPurchaseOrder);
router.post('/:id/submit', submitPurchaseOrder);
router.post('/:id/approve', authorize(Role.SUPER_ADMIN, Role.ADMIN), approvePurchaseOrder);
router.post('/:id/goods-receipt', authorize(Role.SUPER_ADMIN, Role.ADMIN, Role.STORE_MANAGER), recordGoodsReceipt);

export default router;
