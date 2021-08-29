import React from 'react'
import NumericInputGroup from './NumericInputGroup'
import { MathUtils as _Math } from 'three'

const radToDeg = _Math.radToDeg
const degToRad = _Math.degToRad

/**
 *
 * @author Robert Long
 * @param {any} convertTo
 * @param {any} convertFrom
 * @param {any} rest
 * @returns
 */
export function RadianNumericInputGroup({ convertTo, convertFrom, ...rest }) {
  // @ts-ignore
  return <NumericInputGroup {...rest} convertFrom={radToDeg} convertTo={degToRad} />
}

export default RadianNumericInputGroup