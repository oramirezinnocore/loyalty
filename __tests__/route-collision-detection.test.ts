/**
 * Route Collision Detection Test
 *
 * CRITICAL: Prevents Next.js runtime crashes from conflicting dynamic routes
 *
 * Next.js forbids sibling dynamic routes with different names, like:
 *   app/api/business/[id]/...
 *   app/api/business/[slug]/...
 *
 * This causes: "You cannot use different slug names for the same dynamic path"
 *
 * This test walks app/ and fails if conflicting siblings are detected.
 */

import { describe, it, expect } from '@jest/globals'
import * as fs from 'fs'
import * as path from 'path'

interface RouteNode {
  path: string
  dynamicSegments: Set<string>
  children: Map<string, RouteNode>
}

function buildRouteTree(baseDir: string): RouteNode {
  const root: RouteNode = {
    path: baseDir,
    dynamicSegments: new Set(),
    children: new Map()
  }

  function walk(dir: string, node: RouteNode) {
    if (!fs.existsSync(dir)) return

    const entries = fs.readdirSync(dir, { withFileTypes: true })

    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      if (entry.name.startsWith('.')) continue

      const fullPath = path.join(dir, entry.name)

      // Check if this is a dynamic segment
      const isDynamic = entry.name.startsWith('[') && entry.name.endsWith(']')

      if (isDynamic) {
        // Extract the parameter name (e.g., [id] -> id, [...slug] -> ...slug)
        const paramName = entry.name.slice(1, -1)
        node.dynamicSegments.add(paramName)

        // Use normalized key for dynamic segments
        const childKey = `[dynamic:${paramName}]`
        if (!node.children.has(childKey)) {
          node.children.set(childKey, {
            path: fullPath,
            dynamicSegments: new Set(),
            children: new Map()
          })
        }
        walk(fullPath, node.children.get(childKey)!)
      } else {
        // Static segment
        if (!node.children.has(entry.name)) {
          node.children.set(entry.name, {
            path: fullPath,
            dynamicSegments: new Set(),
            children: new Map()
          })
        }
        walk(fullPath, node.children.get(entry.name)!)
      }
    }
  }

  walk(baseDir, root)
  return root
}

function findConflicts(node: RouteNode, currentPath: string = ''): string[] {
  const conflicts: string[] = []

  // Check if this node has conflicting dynamic siblings
  if (node.dynamicSegments.size > 1) {
    const segments = Array.from(node.dynamicSegments).sort()
    conflicts.push(
      `Route conflict at "${currentPath}": found dynamic siblings with different names: ${segments.join(', ')}`
    )
  }

  // Recurse into children
  for (const [key, child] of node.children) {
    const childPath = currentPath ? `${currentPath}/${key}` : key
    conflicts.push(...findConflicts(child, childPath))
  }

  return conflicts
}

describe('Route Collision Detection', () => {
  it('should not have conflicting dynamic route siblings', () => {
    const appDir = path.join(process.cwd(), 'app')
    const routeTree = buildRouteTree(appDir)
    const conflicts = findConflicts(routeTree, 'app')

    if (conflicts.length > 0) {
      console.error('\n❌ Route conflicts detected:')
      conflicts.forEach(conflict => console.error(`  - ${conflict}`))
      console.error('\nNext.js runtime will crash with:')
      console.error('  "You cannot use different slug names for the same dynamic path"\n')
    }

    expect(conflicts).toEqual([])
  })

  it('should allow valid nested dynamic routes', () => {
    // Valid structure examples:
    // app/api/business/[id]/route.ts
    // app/api/business/[id]/activate/route.ts
    // app/api/wallet/[token]/route.ts
    //
    // Each directory level has at most ONE dynamic segment name

    const appDir = path.join(process.cwd(), 'app')

    // Check that we have dynamic routes (this test isn't trivial)
    const hasDynamicRoutes = fs.existsSync(path.join(appDir, 'api/business/[id]'))
      || fs.existsSync(path.join(appDir, 'wallet/[token]'))

    expect(hasDynamicRoutes).toBe(true)
  })

  it('should detect common collision patterns', () => {
    // Test the detector itself with a mock structure
    const mockNode: RouteNode = {
      path: '/test',
      dynamicSegments: new Set(['id', 'slug']), // Conflicting!
      children: new Map()
    }

    const conflicts = findConflicts(mockNode, 'test')

    expect(conflicts.length).toBeGreaterThan(0)
    expect(conflicts[0]).toContain('id')
    expect(conflicts[0]).toContain('slug')
  })
})
