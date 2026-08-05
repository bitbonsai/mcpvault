import { describe, it, expect } from 'vitest'
import { parseWikiLink } from './resolveWikiLink.js'

describe('parseWikiLink', () => {
  it('parses bare name', () => {
    expect(parseWikiLink('My Document')).toEqual({
      document: 'My Document',
    })
  })

  it('strips [[ ]] brackets', () => {
    expect(parseWikiLink('[[My Document]]')).toEqual({
      document: 'My Document',
    })
  })

  it('ignores heading fragment', () => {
    expect(parseWikiLink('[[Note#Heading]]')).toEqual({
      document: 'Note',
    })
  })

  it('ignores block-id fragment', () => {
    expect(parseWikiLink('[[Note#^blockid]]')).toEqual({
      document: 'Note',
    })
  })

  it('strips display text', () => {
    expect(parseWikiLink('[[My Document|Displayed Name]]')).toEqual({
      document: 'My Document',
    })
  })

  it('ignores fragment with display text', () => {
    expect(parseWikiLink('[[My Document#Summary|The Summary]]')).toEqual({
      document: 'My Document',
    })
  })

  it('preserves .ts in basename (module convention)', () => {
    expect(parseWikiLink('[[Module-Foo.ts]]')).toEqual({
      document: 'Module-Foo.ts',
    })
  })

  it('preserves .md in basename', () => {
    expect(parseWikiLink('[[document.md]]')).toEqual({
      document: 'document.md',
    })
  })

  it('ignores fragment on bare name (no brackets)', () => {
    expect(parseWikiLink('My Document#Details')).toEqual({
      document: 'My Document',
    })
  })

  it('handles empty hash', () => {
    expect(parseWikiLink('[[My Document#]]')).toEqual({
      document: 'My Document',
    })
  })

  it('unescapes \\| inside brackets (table-authored link)', () => {
    expect(parseWikiLink('[[My Document\\|Displayed]]')).toEqual({
      document: 'My Document',
    })
  })

  it('unescapes \\| with fragment and display', () => {
    expect(parseWikiLink('[[My Document#Heading\\|Display]]')).toEqual({
      document: 'My Document',
    })
  })

  it('first-pipe-wins after unescape with multiple escaped pipes', () => {
    expect(parseWikiLink('[[A\\|B\\|C]]')).toEqual({
      document: 'A',
    })
  })

  it('rejects pathological double-backslash-pipe as invalid', () => {
    expect(() => parseWikiLink('[[Foo\\\\|Bar]]')).toThrow(/Invalid wiki-link syntax/)
  })

  it('rejects bare input with backslash in parsed document', () => {
    expect(() => parseWikiLink('Foo\\|Bar')).toThrow(/Invalid wiki-link syntax/)
  })
})
