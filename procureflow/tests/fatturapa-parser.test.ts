import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import {
  parseFatturaPA,
  FatturaParseError,
} from '@/server/services/fatturapa-parser.service'

function loadFixture(filename: string): string {
  return readFileSync(join(__dirname, 'fixtures', filename), 'utf-8')
}

describe('parseFatturaPA', () => {
  describe('fattura-match-esatto.xml — match diretto per codice PR', () => {
    const xml = loadFixture('fattura-match-esatto.xml')
    const result = parseFatturaPA(xml)

    it('parsa il formato correttamente', () => {
      expect(result.format).toBe('FPR12')
    })

    it('estrae i dati del fornitore', () => {
      expect(result.supplier.name).toBe('Fornitore Test SpA')
      expect(result.supplier.vat_id).toBe('01234567890')
      expect(result.supplier.vat_country).toBe('IT')
      expect(result.supplier.address?.city).toBe('Roma')
      expect(result.supplier.address?.province).toBe('RM')
    })

    it('estrae i dati del cliente', () => {
      expect(result.customer.vat_id).toBe('09876543210')
    })

    it('estrae i dati del documento', () => {
      expect(result.document_type).toBe('TD01')
      expect(result.document_type_label).toBe('Fattura')
      expect(result.invoice_number).toBe('FT-2025/001')
      expect(result.total_amount).toBe(1220)
    })

    it('estrae la causale con codice PR', () => {
      expect(result.causale).toContain('PR-2025-00001')
    })

    it('estrae il codice PR da DatiOrdineAcquisto', () => {
      expect(result.pr_code_extracted).toBe('PR-2025-00001')
    })

    it('estrae i riferimenti ordine con CIG', () => {
      expect(result.order_references).toHaveLength(1)
      expect(result.order_references[0]?.id_documento).toBe('PR-2025-00001')
      expect(result.order_references[0]?.codice_cig).toBe('ABC1234567')
    })

    it('parsa le righe correttamente', () => {
      expect(result.line_items).toHaveLength(2)

      expect(result.line_items[0]?.description).toBe(
        'Carta A4 80g/m2 - 500 fogli',
      )
      expect(result.line_items[0]?.quantity).toBe(10)
      expect(result.line_items[0]?.unit_price).toBe(5)
      expect(result.line_items[0]?.total_price).toBe(50)
      expect(result.line_items[0]?.vat_rate).toBe(22)

      expect(result.line_items[1]?.description).toBe('Toner HP LaserJet Pro')
      expect(result.line_items[1]?.quantity).toBe(5)
      expect(result.line_items[1]?.total_price).toBe(950)
    })

    it('calcola il riepilogo IVA', () => {
      expect(result.tax_summary).toHaveLength(1)
      expect(result.tax_summary[0]?.taxable_amount).toBe(1000)
      expect(result.tax_summary[0]?.tax_amount).toBe(220)
      expect(result.total_taxable).toBe(1000)
      expect(result.total_tax).toBe(220)
    })

    it('estrae i dati di pagamento', () => {
      expect(result.payment).toBeDefined()
      expect(result.payment?.method).toBe('MP05')
      expect(result.payment?.method_label).toBe('Bonifico')
      expect(result.payment?.amount).toBe(1220)
      expect(result.payment?.iban).toBe('IT60X0542811101000000123456')
    })
  })

  describe('fattura-match-causale.xml — match per causale', () => {
    const xml = loadFixture('fattura-match-causale.xml')
    const result = parseFatturaPA(xml)

    it('estrae il codice PR dalla causale', () => {
      expect(result.pr_code_extracted).toBe('PR-2025-00003')
    })

    it('non ha DatiOrdineAcquisto', () => {
      expect(result.order_references).toHaveLength(0)
    })

    it('parsa 3 righe di dettaglio', () => {
      expect(result.line_items).toHaveLength(3)
    })

    it('importo totale corretto', () => {
      expect(result.total_amount).toBe(610)
    })

    it('fornitore corretto', () => {
      expect(result.supplier.name).toBe('Ufficio Supplies Italia Srl')
      expect(result.supplier.vat_id).toBe('11223344556')
    })
  })

  describe('fattura-no-match.xml — nessun riferimento PR', () => {
    const xml = loadFixture('fattura-no-match.xml')
    const result = parseFatturaPA(xml)

    it('pr_code_extracted è undefined', () => {
      expect(result.pr_code_extracted).toBeUndefined()
    })

    it('nessun riferimento ordine', () => {
      expect(result.order_references).toHaveLength(0)
    })

    it('parsa comunque i dati del documento', () => {
      expect(result.invoice_number).toBe('NA-2025-0055')
      expect(result.total_amount).toBe(366)
      expect(result.supplier.name).toBe('Fornitore Sconosciuto Srl')
    })

    it('pagamento con carta di credito', () => {
      expect(result.payment?.method).toBe('MP08')
      expect(result.payment?.method_label).toBe('Carta di pagamento')
    })
  })

  describe('nota-credito.xml — TD04', () => {
    const xml = loadFixture('nota-credito.xml')
    const result = parseFatturaPA(xml)

    it('tipo documento è Nota di Credito', () => {
      expect(result.document_type).toBe('TD04')
      expect(result.document_type_label).toBe('Nota di credito')
    })

    it('estrae il codice PR dalla causale e dai riferimenti', () => {
      expect(result.pr_code_extracted).toBe('PR-2025-00001')
    })

    it('importo totale positivo (come da XML)', () => {
      expect(result.total_amount).toBe(122)
    })

    it('riga con quantità negativa', () => {
      expect(result.line_items[0]?.quantity).toBe(-1)
      expect(result.line_items[0]?.total_price).toBe(-100)
    })
  })

  describe('fattura-multilinea.xml — multi ordine, multi riga', () => {
    const xml = loadFixture('fattura-multilinea.xml')
    const result = parseFatturaPA(xml)

    it('estrae il primo codice PR dai riferimenti', () => {
      expect(result.pr_code_extracted).toBe('PR-2025-00010')
    })

    it('ha 2 riferimenti ordine', () => {
      expect(result.order_references).toHaveLength(2)
      expect(result.order_references[0]?.id_documento).toBe('PR-2025-00010')
      expect(result.order_references[1]?.id_documento).toBe('PR-2025-00012')
    })

    it('secondo riferimento ha CIG', () => {
      expect(result.order_references[1]?.codice_cig).toBe('ZZZ9876543')
    })

    it('5 righe di dettaglio', () => {
      expect(result.line_items).toHaveLength(5)
    })

    it('importo totale corretto', () => {
      expect(result.total_amount).toBe(9394)
    })

    it('causale menziona entrambi gli ordini', () => {
      expect(result.causale).toContain('PR-2025-00010')
      expect(result.causale).toContain('PR-2025-00012')
    })
  })

  describe('gestione errori', () => {
    it('lancia FatturaParseError per XML invalido', () => {
      expect(() => parseFatturaPA('not xml')).toThrow(FatturaParseError)
    })

    it('lancia FatturaParseError se manca root element', () => {
      expect(() =>
        parseFatturaPA('<?xml version="1.0"?><root></root>'),
      ).toThrow('Elemento root FatturaElettronica non trovato')
    })

    it('lancia FatturaParseError se manca header', () => {
      const xml = `<?xml version="1.0"?><FatturaElettronica versione="FPR12"><FatturaElettronicaBody></FatturaElettronicaBody></FatturaElettronica>`
      expect(() => parseFatturaPA(xml)).toThrow(
        'FatturaElettronicaHeader mancante',
      )
    })
  })
})
