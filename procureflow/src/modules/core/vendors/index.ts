// Export pubblico del modulo vendors.
// Chi vuole usare il modulo importa DA QUI, non dai file interni.

// Services
export { sendOrderToVendor } from './server/vendor-order.service'

// Tools AI
export {
  findOrCreateVendorTool,
  updateVendorTool,
  VENDOR_TOOLS,
} from './server/vendor.tools'

// Validations
export {
  createVendorSchema,
  updateVendorSchema,
  quickCreateVendorSchema,
  type CreateVendorInput,
  type UpdateVendorInput,
  type QuickCreateVendorInput,
} from './validations/vendor'

// Hooks
export {
  useVendors,
  useVendor,
  useCreateVendor,
  useUpdateVendor,
  type VendorListItem,
  type VendorDetail,
  type VendorContact,
  type VendorRequest,
  type VendorListParams,
} from './hooks/use-vendors'

// Components
export { VendorsPageContent } from './components/vendors-page-content'
export { VendorDetailContent } from './components/vendor-detail-content'
export { VendorCard } from './components/vendor-card'
export { VendorCreateDialog } from './components/vendor-create-dialog'
export { VendorEditDialog } from './components/vendor-edit-dialog'
