import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  getTopControlsRowClass,
  getTrafficLightAvoidanceClass,
  getTrafficLightInsetPx,
  getWindowDragRegionClass
} from './window-chrome'

describe('window chrome layout tokens', () => {
  it('exposes the traffic-light inset as a single numeric source of truth', () => {
    assert.equal(getTrafficLightInsetPx(), 80)
  })

  it('uses a height-only Tailwind class for the traffic-light avoidance zone', () => {
    // 宽度由 inline style 注入 getTrafficLightInsetPx(),类里不再含 w- 字面量。
    assert.equal(
      getTrafficLightAvoidanceClass(),
      'pointer-events-none absolute left-0 top-0 z-50 h-9'
    )
    assert.doesNotMatch(getTrafficLightAvoidanceClass(), /\bw-\d/)
  })

  it('limits the draggable window background to the top h-9 strip', () => {
    assert.equal(getWindowDragRegionClass(), 'h-9')
  })

  it('anchors the top controls row to the window without a left- class', () => {
    // 左侧定位由 inline style 注入,类里只保留结构与拖拽语义。
    assert.match(getTopControlsRowClass(), /\bapp-drag\b/)
    assert.match(getTopControlsRowClass(), /\babsolute\b/)
    assert.match(getTopControlsRowClass(), /\bright-0\b/)
    assert.match(getTopControlsRowClass(), /\bh-9\b/)
    assert.doesNotMatch(getTopControlsRowClass(), /\bleft-\d/)
    assert.doesNotMatch(getTopControlsRowClass(), /\bapp-no-drag\b/)
  })
})
