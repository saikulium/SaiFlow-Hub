// ---------------------------------------------------------------------------
// Tipi TypeScript per il formato FatturaPA (Fatturazione Elettronica Italiana)
// Riferimento: https://www.fatturapa.gov.it/it/norme-e-regole/documentazione-fatturapa/
// ---------------------------------------------------------------------------

/** Risultato del parsing di un XML FatturaPA */
export interface ParsedInvoice {
  readonly format: 'FPR12' | 'FPA12'
  readonly transmission_id: string

  readonly supplier: {
    readonly vat_country: string
    readonly vat_id: string
    readonly tax_code?: string
    readonly name: string
    readonly address?: {
      readonly street: string
      readonly city: string
      readonly zip: string
      readonly province: string
    }
  }

  readonly customer: {
    readonly vat_id: string
    readonly tax_code?: string
  }

  readonly document_type: string
  readonly document_type_label: string
  readonly invoice_number: string
  readonly invoice_date: Date
  readonly total_amount: number
  readonly causale?: string

  readonly order_references: readonly OrderReference[]
  readonly pr_code_extracted?: string

  readonly line_items: readonly ParsedLineItem[]

  readonly tax_summary: readonly TaxSummaryItem[]
  readonly total_taxable: number
  readonly total_tax: number

  readonly payment?: PaymentInfo
}

export interface OrderReference {
  readonly id_documento?: string
  readonly data?: Date
  readonly num_item?: string
  readonly codice_commessa?: string
  readonly codice_cup?: string
  readonly codice_cig?: string
}

export interface ParsedLineItem {
  readonly line_number: number
  readonly description: string
  readonly quantity: number
  readonly unit_of_measure?: string
  readonly unit_price: number
  readonly total_price: number
  readonly vat_rate: number
  readonly vat_nature?: string
}

export interface TaxSummaryItem {
  readonly vat_rate: number
  readonly taxable_amount: number
  readonly tax_amount: number
  readonly nature?: string
}

export interface PaymentInfo {
  readonly method: string
  readonly method_label: string
  readonly due_date?: Date
  readonly amount: number
  readonly iban?: string
  readonly terms?: string
}

// ---------------------------------------------------------------------------
// Costanti di mapping SDI
// ---------------------------------------------------------------------------

/** Tipi documento FatturaPA */
export const DOCUMENT_TYPES: Readonly<Record<string, string>> = {
  TD01: 'Fattura',
  TD02: 'Acconto/Anticipo su fattura',
  TD03: 'Acconto/Anticipo su parcella',
  TD04: 'Nota di credito',
  TD05: 'Nota di debito',
  TD06: 'Parcella',
  TD16: 'Integrazione fattura reverse charge interno',
  TD17: 'Integrazione/autofattura acquisto servizi estero',
  TD18: 'Integrazione acquisto beni intracomunitari',
  TD19: 'Integrazione/autofattura acquisto beni art.17 c.2',
  TD20: 'Autofattura/regolarizzazione',
  TD21: 'Autofattura splafonamento',
  TD22: 'Estrazione beni da deposito IVA',
  TD23: 'Estrazione beni da deposito IVA con versamento',
  TD24: 'Fattura differita art.21 c.4 lett.a',
  TD25: 'Fattura differita art.21 c.4 terzo periodo lett.b',
  TD26: 'Cessione beni ammortizzabili / passaggi interni',
  TD27: 'Autoconsumo/cessioni gratuite senza rivalsa',
}

/** Modalità di pagamento SDI */
export const PAYMENT_METHODS: Readonly<Record<string, string>> = {
  MP01: 'Contanti',
  MP02: 'Assegno',
  MP03: 'Assegno circolare',
  MP04: 'Contanti presso Tesoreria',
  MP05: 'Bonifico',
  MP06: 'Vaglia cambiario',
  MP07: 'Bollettino bancario',
  MP08: 'Carta di pagamento',
  MP09: 'RID',
  MP10: 'RID utenze',
  MP11: 'RID veloce',
  MP12: 'RIBA',
  MP13: 'MAV',
  MP14: 'Quietanza erario',
  MP15: 'Giroconto su conti di contabilità speciale',
  MP16: 'Domiciliazione bancaria',
  MP17: 'Domiciliazione postale',
  MP18: 'Bollettino di c/c postale',
  MP19: 'SEPA Direct Debit',
  MP20: 'SEPA Direct Debit CORE',
  MP21: 'SEPA Direct Debit B2B',
  MP22: 'Trattenuta su somme già riscosse',
  MP23: 'PagoPA',
}

/** Natura operazioni esenti/non imponibili IVA */
export const VAT_NATURE_CODES: Readonly<Record<string, string>> = {
  N1: 'Escluse ex art.15',
  'N2.1': 'Non soggette — art.7',
  'N2.2': 'Non soggette — altri casi',
  'N3.1': 'Non imponibili — esportazioni',
  'N3.2': 'Non imponibili — cessioni intracomunitarie',
  'N3.3': 'Non imponibili — verso San Marino',
  'N3.4': 'Non imponibili — operazioni assimilate',
  'N3.5': 'Non imponibili — dichiarazione intento',
  'N3.6': 'Non imponibili — altre operazioni',
  N4: 'Esenti',
  N5: 'Regime del margine / IVA non esposta',
  'N6.1': 'Inversione contabile — cessione rottami',
  'N6.2': 'Inversione contabile — cessione oro/argento',
  'N6.3': 'Inversione contabile — subappalto edilizia',
  'N6.4': 'Inversione contabile — cessione fabbricati',
  'N6.5': 'Inversione contabile — cessione telefoni',
  'N6.6': 'Inversione contabile — prodotti elettronici',
  'N6.7': 'Inversione contabile — prestazioni comparto edile',
  'N6.8': 'Inversione contabile — settore energetico',
  'N6.9': 'Inversione contabile — altri casi',
  N7: 'IVA assolta in altro Stato UE',
}
