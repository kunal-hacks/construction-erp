import { Router } from 'express';
import { getVendors, getVendorById, createVendor, updateVendor, deleteVendor } from '../controllers/vendors.controller';
import { authenticate, authorize } from '../middleware/auth';
import { Role } from '@prisma/client';

const router = Router();
router.use(authenticate);

router.get('/', getVendors);
router.get('/:id', getVendorById);
router.post('/', authorize(Role.SUPER_ADMIN, Role.ADMIN), createVendor);
router.put('/:id', authorize(Role.SUPER_ADMIN, Role.ADMIN), updateVendor);
router.delete('/:id', authorize(Role.SUPER_ADMIN), deleteVendor);

export default router;
