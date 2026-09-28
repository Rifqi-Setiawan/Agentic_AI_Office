import { memo } from 'react'
import { BaseEdge } from '@xyflow/react'
import type { Edge, EdgeProps } from '@xyflow/react'
import { roundedPath } from './graphModel'

export type CircuitData = Record<string, unknown> & { laneOffset: number; horizontal: boolean; active: boolean }
export type CircuitEdgeType = Edge<CircuitData, 'circuit'>
export const CircuitEdge = memo(function CircuitEdge({ id, sourceX, sourceY, targetX, targetY, data, markerEnd }: EdgeProps<CircuitEdgeType>) {
  if (!data) return null
  const points = data.horizontal
    ? [{ x: sourceX, y: sourceY }, { x: targetX, y: targetY }]
    : [{ x: sourceX, y: sourceY }, { x: sourceX, y: sourceY + data.laneOffset },
      { x: targetX, y: sourceY + data.laneOffset }, { x: targetX, y: targetY }]
  return <BaseEdge id={id} path={roundedPath(points, 8)} markerEnd={markerEnd} interactionWidth={0}
    className={data.active ? 'mc-circuit mc-circuit--active' : 'mc-circuit'} />
})
