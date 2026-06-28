import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getTitlebarGutterPx } from './titlebar-gutter'

describe('getTitlebarGutterPx', () => {
  it('reserves enough vertical space for macOS traffic-light controls', () => {
    assert.ok(getTitlebarGutterPx() >= 35, `expected at least 35px, got ${getTitlebarGutterPx()}px`)
  })
})
