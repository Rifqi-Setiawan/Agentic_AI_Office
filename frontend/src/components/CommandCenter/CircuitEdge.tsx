import { memo } from 'react'
import { BaseEdge } from '@xyflow/react'
import type { Edge, EdgeProps } from '@xyflow/react'
import { ROUTES, pairKey, routePoints, roundedPath } from './graphModel'

export type CircuitData = Record<string, unknown> & { laneOffset: number; horizontal: boolean; active: boolean }
export type CircuitEdgeType = Edge<CircuitData, 'circuit'>

export const CircuitEdge = memo(function CircuitEdge({ id, sourceX, sourceY, targetX, targetY, data, markerEnd }: EdgeProps<CircuitEdgeType>) {
  if (!data) return null

  const route = ROUTES.find(r => pairKey(r.source, r.target) === id)
  const staticPts = route ? routePoints(route) : null

  const measuredPoints = (sourceX != null && !isNaN(sourceX) && targetX != null && !isNaN(targetX))
    ? (data.horizontal
        ? [{ x: sourceX, y: sourceY }, { x: targetX, y: targetY }]
        : [{ x: sourceX, y: sourceY }, { x: sourceX, y: sourceY + data.laneOffset },
          { x: targetX, y: sourceY + data.laneOffset }, { x: targetX, y: targetY }])
    : null

  const points = measuredPoints || staticPts
  if (!points || points.length < 2) return null

  return (
    <BaseEdge
      id={id}
      path={roundedPath(points, 8)}
      markerEnd={markerEnd}
      interactionWidth={0}
      className={data.active ? 'mc-circuit mc-circuit--active' : 'mc-circuit'}
    />
  )
})
