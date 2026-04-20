export const AUDITED_MODELS = new Set<string>([
  'User',
  'PurchaseRequest',
  'RequestItem',
  'Approval',
  'Invoice',
  'PriceVarianceReview',
  'Vendor',
  'Client',
  'Article',
  'ArticleAlias',
  'Budget',
  'Commessa',
  'Tender',
  'Material',
  'Warehouse',
  'StockLot',
  'DeployConfig',
])

export const USER_AUDITED_FIELDS = new Set<string>([
  'role',
  'totp_enabled',
  'email',
  'department',
])

export const ENTITY_LABEL_FIELD: Record<string, string> = {
  User: 'email',
  PurchaseRequest: 'code',
  Commessa: 'code',
  Client: 'code',
  Vendor: 'code',
  Article: 'code',
  ArticleAlias: 'alias_code',
  Invoice: 'invoice_number',
  Budget: 'cost_center',
  Tender: 'code',
  Material: 'code',
  Warehouse: 'code',
  StockLot: 'lot_number',
}
