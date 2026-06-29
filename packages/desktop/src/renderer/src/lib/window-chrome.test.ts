import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  getTopControlsRowClass,
  getTrafficLightAvoidanceClass,
  getWindowDragRegionClass
} from './window-chrome'

describe('window chrome layout tokens', () => {
  it('uses Tailwind scale classes for the traffic-light avoidance zone', () => {
    assert.equal(getTrafficLightAvoidanceClass(), 'w-24 h-9')
  })

  it('limits the draggable window background to the top h-9 strip', () => {
    assert.equal(getWindowDragRegionClass(), 'h-9')
  })

  it('anchors the top controls row to the window instead of page flow', () => {
    assert.match(getTopControlsRowClass(), /\bapp-drag\b/)
    assert.match(getTopControlsRowClass(), /\babsolute\b/)
    assert.match(getTopControlsRowClass(), /\bleft-24\b/)
    assert.doesNotMatch(getTopControlsRowClass(), /\bml-24\b/)
    assert.doesNotMatch(getTopControlsRowClass(), /\bapp-no-drag\b/)
  })
})
