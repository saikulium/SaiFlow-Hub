export interface RequestSuggestion {
  readonly vendor_id?: string
  readonly category?: string
  readonly priority?: string
  readonly department?: string
  readonly cost_center?: string
  readonly estimated_amount?: number
  readonly items?: readonly {
    readonly name: string
    readonly quantity: number
    readonly unit?: string
    readonly unit_price?: number
    readonly total_price?: number
    readonly sku?: string
  }[]
}
