import type { CanvasElement, CanvasLeafElement } from '../types/canvas-data.types';
import { isCanvasGroupElement } from '../types/canvas-data.types';

/**
 * Pure tree helpers over the nested `CanvasElement[]` structure — a straight port of the
 * frontend's `element-tree.util.ts` (same formulas), minus anything Konva/Vue-specific. Backend
 * only ever reads the tree (validation, PDF/placeholder consumption); it never mutates it, so this
 * file only carries the read-side subset (`findNodeById`, `getDescendants`, `flattenTree`,
 * `mapTree`, the absolute-transform composition math).
 */

export function findNodeById(root: CanvasElement[], id: string): CanvasElement | null {
  for (const node of root) {
    if (node.id === id) {
      return node;
    }

    if (isCanvasGroupElement(node)) {
      const found = findNodeById(node.children, id);
      if (found) {
        return found;
      }
    }
  }

  return null;
}

export function getDescendants(node: CanvasElement): CanvasElement[] {
  if (!isCanvasGroupElement(node)) {
    return [];
  }

  const result: CanvasElement[] = [];
  for (const child of node.children) {
    result.push(child);
    result.push(...getDescendants(child));
  }

  return result;
}

/** Recurse into `group.children`, mapping only leaf nodes — used by normalization/migration. */
export function mapTree(
  nodes: CanvasElement[],
  mapLeaf: (leaf: CanvasLeafElement) => CanvasLeafElement,
): CanvasElement[] {
  return nodes.map((node) => {
    if (isCanvasGroupElement(node)) {
      return { ...node, children: mapTree(node.children, mapLeaf) };
    }

    return mapLeaf(node as CanvasLeafElement);
  });
}

export function walkTree(nodes: CanvasElement[], visit: (node: CanvasElement) => void): void {
  for (const node of nodes) {
    visit(node);
    if (isCanvasGroupElement(node)) {
      walkTree(node.children, visit);
    }
  }
}

// ---------------------------------------------------------------------------
// Rigid 2D transform composition (translate + rotate around center pivot) — same math as the
// frontend util; see that file's comment for the derivation from the outer/inner Konva structure.
// ---------------------------------------------------------------------------

export interface AbsoluteBox {
  x: number;
  y: number;
  rotationDeg: number;
}

export const ROOT_FRAME: AbsoluteBox = { x: 0, y: 0, rotationDeg: 0 };

function rotateVector(vx: number, vy: number, deg: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return { x: vx * cos - vy * sin, y: vx * sin + vy * cos };
}

function childBoxFromLocal(
  local: { position: { x: number; y: number }; rotation: number },
  parentContentFrame: AbsoluteBox,
): AbsoluteBox {
  const rotated = rotateVector(local.position.x, local.position.y, parentContentFrame.rotationDeg);
  return {
    x: parentContentFrame.x + rotated.x,
    y: parentContentFrame.y + rotated.y,
    rotationDeg: parentContentFrame.rotationDeg + local.rotation,
  };
}

function contentFrameOf(box: AbsoluteBox, size: { width: number; height: number }): AbsoluteBox {
  const halfX = size.width / 2;
  const halfY = size.height / 2;
  const rotatedHalf = rotateVector(halfX, halfY, box.rotationDeg);
  return {
    x: box.x + halfX - rotatedHalf.x,
    y: box.y + halfY - rotatedHalf.y,
    rotationDeg: box.rotationDeg,
  };
}

function getAbsoluteBox(path: CanvasElement[]): AbsoluteBox {
  let frame: AbsoluteBox = ROOT_FRAME;
  let box: AbsoluteBox = frame;

  for (const node of path) {
    box = childBoxFromLocal(node, frame);
    frame = contentFrameOf(box, node.size);
  }

  return box;
}

function getPath(root: CanvasElement[], id: string): CanvasElement[] {
  function search(nodes: CanvasElement[], trail: CanvasElement[]): CanvasElement[] | null {
    for (const node of nodes) {
      if (node.id === id) {
        return [...trail, node];
      }

      if (isCanvasGroupElement(node)) {
        const found = search(node.children, [...trail, node]);
        if (found) {
          return found;
        }
      }
    }

    return null;
  }

  return search(root, []) ?? [];
}

export function getAbsoluteTransform(root: CanvasElement[], id: string): AbsoluteBox {
  return getAbsoluteBox(getPath(root, id));
}

/** Leaves only, in paint order (depth-first, preorder), with ABSOLUTE page coordinates. */
export function flattenTree(nodes: CanvasElement[]): CanvasLeafElement[] {
  const result: CanvasLeafElement[] = [];

  function walk(list: CanvasElement[], parentFrame: AbsoluteBox): void {
    for (const node of list) {
      const box = childBoxFromLocal(node, parentFrame);

      if (isCanvasGroupElement(node)) {
        walk(node.children, contentFrameOf(box, node.size));
      } else {
        result.push({ ...(node as CanvasLeafElement), position: { x: box.x, y: box.y }, rotation: box.rotationDeg });
      }
    }
  }

  walk(nodes, ROOT_FRAME);
  return result;
}
