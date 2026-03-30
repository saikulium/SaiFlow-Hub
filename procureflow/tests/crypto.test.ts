import { describe, it, expect, beforeAll } from 'vitest'

beforeAll(() => {
  process.env.ENCRYPTION_KEY = 'a'.repeat(64)
})

describe('crypto', () => {
  it('encrypts and decrypts a string', async () => {
    const { encrypt, decrypt } = await import('@/lib/crypto')
    const plaintext = '{"host":"mail.example.com","password":"secret123"}'
    const encrypted = encrypt(plaintext)
    expect(encrypted).not.toBe(plaintext)
    expect(encrypted).toContain(':')
    const decrypted = decrypt(encrypted)
    expect(decrypted).toBe(plaintext)
  })

  it('produces different ciphertext for same input (random IV)', async () => {
    const { encrypt } = await import('@/lib/crypto')
    const plaintext = 'test'
    const a = encrypt(plaintext)
    const b = encrypt(plaintext)
    expect(a).not.toBe(b)
  })

  it('throws on tampered ciphertext', async () => {
    const { encrypt, decrypt } = await import('@/lib/crypto')
    const encrypted = encrypt('test')
    const tampered = encrypted.slice(0, -2) + 'XX'
    expect(() => decrypt(tampered)).toThrow()
  })
})
