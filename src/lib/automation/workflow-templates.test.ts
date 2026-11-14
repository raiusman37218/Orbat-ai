import { describe, expect, it } from 'vitest';
import {
  BLOCK_PALETTE,
  WORKFLOW_TEMPLATES,
  edgeBezierPath,
  getWorkflowTemplate,
  nextNodePosition,
  simulateWorkflowPath,
} from './workflow-templates';

describe('automation workflow templates & simulator', () => {
  it('provides 7 well-formed starter templates with valid edges', () => {
    expect(WORKFLOW_TEMPLATES).toHaveLength(7);
    expect(BLOCK_PALETTE.map((b) => b.kind)).toEqual([
      'Trigger',
      'AI',
      'Condition',
      'Action',
      'Delay',
      'Handoff',
    ]);

    for (const tpl of WORKFLOW_TEMPLATES) {
      const ids = new Set(tpl.nodes.map((n) => n.id));
      expect(tpl.nodes.length).toBeGreaterThanOrEqual(3);
      for (const edge of tpl.edges) {
        expect(ids.has(edge.from)).toBe(true);
        expect(ids.has(edge.to)).toBe(true);
      }
      const d = edgeBezierPath(tpl.nodes[0], tpl.nodes[1]);
      expect(d.startsWith('M ')).toBe(true);
      expect(d).toContain(' C ');
    }
  });

  it('branches cleanly on order_status template depending on order number presence', () => {
    const orderTpl = getWorkflowTemplate('order_status');

    const withOrder = simulateWorkflowPath(orderTpl.nodes, orderTpl.edges, {
      message: 'Where is ORD-1042?',
    });
    expect(withOrder.visitedIds).toEqual(['n1', 'n2', 'n3']);
    expect(withOrder.pathSummary).toContain('Lookup order & summarize');

    const withoutOrder = simulateWorkflowPath(orderTpl.nodes, orderTpl.edges, {
      message: 'Where is my package?',
    });
    expect(withoutOrder.visitedIds).toEqual(['n1', 'n2', 'n4']);
    expect(withoutOrder.outcome).toBe('resolved');
  });

  it('computes non-overlapping vertical positions for newly appended nodes', () => {
    const tpl = getWorkflowTemplate('welcome');
    const maxY = Math.max(...tpl.nodes.map((n) => n.y));
    const next = nextNodePosition(tpl.nodes);
    expect(next.y).toBeGreaterThan(maxY);
  });
});
