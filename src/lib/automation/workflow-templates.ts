export type WorkflowNodeKind = 'Trigger' | 'AI' | 'Condition' | 'Action' | 'Delay' | 'Handoff';
export type WorkflowStatus = 'live' | 'paused' | 'draft' | 'error';

export interface WorkflowNode {
  id: string;
  kind: WorkflowNodeKind;
  label: string;
  subtitle: string;
  x: number;
  y: number;
  tone?: 'ai' | 'ok' | 'warn' | 'bad' | 'accent';
  branch?: 'yes' | 'no' | null;
  config: Record<string, string | number | boolean>;
}

export interface WorkflowEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  condition?: 'yes' | 'no' | 'always';
}

export interface WorkflowTemplateSpec {
  key: string;
  name: string;
  description: string;
  triggerKind: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface PaletteBlockSpec {
  kind: WorkflowNodeKind;
  label: string;
  subtitle: string;
  tone?: WorkflowNode['tone'];
  defaultConfig: Record<string, string | number | boolean>;
}

export const BLOCK_PALETTE: PaletteBlockSpec[] = [
  {
    kind: 'Trigger',
    label: 'Conversation started',
    subtitle: 'When a visitor opens a new chat or email thread',
    tone: 'accent',
    defaultConfig: { event: 'conversation_created', channel: 'all' },
  },
  {
    kind: 'AI',
    label: 'AI intent & draft',
    subtitle: 'Classify intent and draft answer from Help Center',
    tone: 'ai',
    defaultConfig: {
      prompt: 'Read the customer message, detect intent, and answer from Help Center.',
      minConfidence: 0.72,
      fallback: 'handoff',
    },
  },
  {
    kind: 'Condition',
    label: 'Branch condition',
    subtitle: 'Check order number, channel, tag, or confidence score',
    defaultConfig: { field: 'order_number', operator: 'present', value: '' },
  },
  {
    kind: 'Action',
    label: 'Send reply / tag',
    subtitle: 'Send automated reply, add tag, or create ticket',
    tone: 'ok',
    defaultConfig: { actionType: 'send_reply', template: 'We are looking into your request.' },
  },
  {
    kind: 'Delay',
    label: 'Wait window',
    subtitle: 'Pause workflow execution before checking reply state',
    tone: 'warn',
    defaultConfig: { minutes: 15 },
  },
  {
    kind: 'Handoff',
    label: 'Assign to team',
    subtitle: 'Route conversation to an online agent or specialist queue',
    tone: 'bad',
    defaultConfig: { team: 'Support queue', priority: 'normal', internalNote: 'Escalated by workflow' },
  },
];

export const WORKFLOW_TEMPLATES: WorkflowTemplateSpec[] = [
  {
    key: 'welcome',
    name: 'Welcome message',
    description: 'Greet first-time visitors on web chat, answer FAQs with AI, and escalate when needed.',
    triggerKind: 'conversation_created',
    nodes: [
      {
        id: 'n1',
        kind: 'Trigger',
        label: 'New web conversation',
        subtitle: 'Visitor opens widget & sends message',
        x: 220,
        y: 28,
        tone: 'accent',
        config: { event: 'conversation_created', channel: 'web' },
      },
      {
        id: 'n2',
        kind: 'AI',
        label: 'AI knowledge lookup',
        subtitle: 'Search Help Center & draft response',
        x: 220,
        y: 146,
        tone: 'ai',
        config: {
          prompt: 'Greet the customer warmly and answer their opening question concisely.',
          minConfidence: 0.75,
          fallback: 'handoff',
        },
      },
      {
        id: 'n3',
        kind: 'Condition',
        label: 'Confidence >= 75%?',
        subtitle: 'Verify grounded answer quality',
        x: 220,
        y: 266,
        config: { field: 'ai_confidence', operator: '>=', value: 0.75 },
      },
      {
        id: 'n4',
        kind: 'Action',
        label: 'Send AI reply',
        subtitle: 'Deliver instant response in thread',
        x: 70,
        y: 396,
        tone: 'ok',
        branch: 'yes',
        config: { actionType: 'send_reply', template: '{{ai_draft}}' },
      },
      {
        id: 'n5',
        kind: 'Handoff',
        label: 'Route to inbox team',
        subtitle: 'Assign to available support agent',
        x: 370,
        y: 396,
        tone: 'bad',
        branch: 'no',
        config: { team: 'General Support', priority: 'normal' },
      },
    ],
    edges: [
      { id: 'e1', from: 'n1', to: 'n2', condition: 'always' },
      { id: 'e2', from: 'n2', to: 'n3', condition: 'always' },
      { id: 'e3', from: 'n3', to: 'n4', label: 'Yes', condition: 'yes' },
      { id: 'e4', from: 'n3', to: 'n5', label: 'No', condition: 'no' },
    ],
  },
  {
    key: 'order_status',
    name: 'Order status',
    description: 'Detect order tracking questions, verify order ID, and share live fulfillment status.',
    triggerKind: 'message_received',
    nodes: [
      {
        id: 'n1',
        kind: 'Trigger',
        label: 'Customer asks about order',
        subtitle: 'Inbound chat or email matches tracking intent',
        x: 220,
        y: 28,
        tone: 'accent',
        config: { event: 'message_received', channel: 'all' },
      },
      {
        id: 'n2',
        kind: 'Condition',
        label: 'Order # in message?',
        subtitle: 'Check ORD-1234 or #1234 pattern',
        x: 220,
        y: 146,
        config: { field: 'order_number', operator: 'present', value: '' },
      },
      {
        id: 'n3',
        kind: 'AI',
        label: 'Lookup order & summarize',
        subtitle: 'Read customer_orders & explain ETA',
        x: 70,
        y: 276,
        tone: 'ai',
        branch: 'yes',
        config: {
          prompt: 'Summarize the latest order status, carrier, and delivery window cleanly.',
          minConfidence: 0.7,
          fallback: 'handoff',
        },
      },
      {
        id: 'n4',
        kind: 'Action',
        label: 'Ask for order number',
        subtitle: 'Prompt customer to share order ID',
        x: 370,
        y: 276,
        tone: 'ok',
        branch: 'no',
        config: { actionType: 'send_reply', template: 'Could you share your order number (e.g. ORD-1042) so I can check live status?' },
      },
      {
        id: 'n5',
        kind: 'Handoff',
        label: 'Escalate delayed shipment',
        subtitle: 'Hand off if customer remains unsatisfied',
        x: 220,
        y: 406,
        tone: 'bad',
        config: { team: 'Fulfillment', priority: 'high' },
      },
    ],
    edges: [
      { id: 'e1', from: 'n1', to: 'n2', condition: 'always' },
      { id: 'e2', from: 'n2', to: 'n3', label: 'Yes', condition: 'yes' },
      { id: 'e3', from: 'n2', to: 'n4', label: 'No', condition: 'no' },
      { id: 'e4', from: 'n3', to: 'n5', label: 'Fallback', condition: 'no' },
    ],
  },
  {
    key: 'refund_requests',
    name: 'Refund requests',
    description: 'Triage refund & return inquiries with policy verification before routing to billing.',
    triggerKind: 'conversation_created',
    nodes: [
      {
        id: 'n1',
        kind: 'Trigger',
        label: 'Refund inquiry started',
        subtitle: 'Tag or keyword matches refund / return',
        x: 220,
        y: 28,
        tone: 'accent',
        config: { event: 'conversation_created', keyword: 'refund' },
      },
      {
        id: 'n2',
        kind: 'AI',
        label: 'Check return policy window',
        subtitle: 'Evaluate 30-day eligibility with AI',
        x: 220,
        y: 146,
        tone: 'ai',
        config: {
          prompt: 'Confirm refund eligibility using workspace return policy and ask for receipt if missing.',
          minConfidence: 0.78,
          fallback: 'handoff',
        },
      },
      {
        id: 'n3',
        kind: 'Handoff',
        label: 'Billing specialist queue',
        subtitle: 'Transfer with full refund context',
        x: 220,
        y: 276,
        tone: 'bad',
        config: { team: 'Billing', priority: 'high' },
      },
    ],
    edges: [
      { id: 'e1', from: 'n1', to: 'n2', condition: 'always' },
      { id: 'e2', from: 'n2', to: 'n3', condition: 'always' },
    ],
  },
  {
    key: 'lead_qualification',
    name: 'Lead qualification',
    description: 'Capture team size & use-case on pricing pages before booking an account executive.',
    triggerKind: 'conversation_created',
    nodes: [
      {
        id: 'n1',
        kind: 'Trigger',
        label: 'Pricing page chat opened',
        subtitle: 'Visitor starts chat on /pricing',
        x: 220,
        y: 28,
        tone: 'accent',
        config: { event: 'conversation_created', page: '/pricing' },
      },
      {
        id: 'n2',
        kind: 'AI',
        label: 'Qualify team size & plan',
        subtitle: 'Ask 2 concise discovery questions',
        x: 220,
        y: 146,
        tone: 'ai',
        config: {
          prompt: 'Ask how many support seats they need and current monthly conversation volume.',
          minConfidence: 0.7,
        },
      },
      {
        id: 'n3',
        kind: 'Handoff',
        label: 'Route to sales team',
        subtitle: 'Assign high-intent lead to AE queue',
        x: 220,
        y: 276,
        tone: 'ok',
        config: { team: 'Sales', priority: 'high' },
      },
    ],
    edges: [
      { id: 'e1', from: 'n1', to: 'n2', condition: 'always' },
      { id: 'e2', from: 'n2', to: 'n3', condition: 'always' },
    ],
  },
  {
    key: 'ticket_routing',
    name: 'Ticket routing',
    description: 'Classify urgent technical bugs vs billing requests and route with SLA priority.',
    triggerKind: 'ticket_created',
    nodes: [
      {
        id: 'n1',
        kind: 'Trigger',
        label: 'Ticket created',
        subtitle: 'From inbox handoff or email gateway',
        x: 220,
        y: 28,
        tone: 'accent',
        config: { event: 'ticket_created' },
      },
      {
        id: 'n2',
        kind: 'AI',
        label: 'Classify topic & urgency',
        subtitle: 'Assign billing, technical, or account tag',
        x: 220,
        y: 146,
        tone: 'ai',
        config: { prompt: 'Classify topic as billing, technical, or account and set urgency.', minConfidence: 0.7 },
      },
      {
        id: 'n3',
        kind: 'Action',
        label: 'Apply priority & tag',
        subtitle: 'Update ticket metadata & notify assignee',
        x: 220,
        y: 276,
        tone: 'ok',
        config: { actionType: 'add_tag', tag: 'triaged' },
      },
    ],
    edges: [
      { id: 'e1', from: 'n1', to: 'n2', condition: 'always' },
      { id: 'e2', from: 'n2', to: 'n3', condition: 'always' },
    ],
  },
  {
    key: 'follow_up',
    name: 'Follow-up reminder',
    description: 'Wait 24 hours after an agent reply, nudge quiet customers, or cleanly close.',
    triggerKind: 'agent_replied',
    nodes: [
      {
        id: 'n1',
        kind: 'Trigger',
        label: 'Agent sends reply',
        subtitle: 'Status moves to pending customer response',
        x: 220,
        y: 28,
        tone: 'accent',
        config: { event: 'agent_replied' },
      },
      {
        id: 'n2',
        kind: 'Delay',
        label: 'Wait 24 hours',
        subtitle: 'Pause if customer replies beforehand',
        x: 220,
        y: 146,
        tone: 'warn',
        config: { minutes: 1440 },
      },
      {
        id: 'n3',
        kind: 'Action',
        label: 'Send gentle check-in',
        subtitle: 'Ask if anything else is needed',
        x: 220,
        y: 276,
        tone: 'ok',
        config: { actionType: 'send_reply', template: 'Just checking in — did everything work out on your end?' },
      },
    ],
    edges: [
      { id: 'e1', from: 'n1', to: 'n2', condition: 'always' },
      { id: 'e2', from: 'n2', to: 'n3', condition: 'always' },
    ],
  },
  {
    key: 'feedback',
    name: 'Customer feedback',
    description: 'Send an automated CSAT survey prompt 5 minutes after a conversation closes.',
    triggerKind: 'conversation_closed',
    nodes: [
      {
        id: 'n1',
        kind: 'Trigger',
        label: 'Conversation resolved',
        subtitle: 'Closed by AI or support agent',
        x: 220,
        y: 28,
        tone: 'accent',
        config: { event: 'conversation_closed' },
      },
      {
        id: 'n2',
        kind: 'Delay',
        label: 'Wait 5 minutes',
        subtitle: 'Avoid interrupting active follow-up',
        x: 220,
        y: 146,
        tone: 'warn',
        config: { minutes: 5 },
      },
      {
        id: 'n3',
        kind: 'Action',
        label: 'Send CSAT rating card',
        subtitle: 'Collect 1–5 rating and optional comment',
        x: 220,
        y: 276,
        tone: 'ok',
        config: { actionType: 'send_csat', surveyKind: 'csat' },
      },
    ],
    edges: [
      { id: 'e1', from: 'n1', to: 'n2', condition: 'always' },
      { id: 'e2', from: 'n2', to: 'n3', condition: 'always' },
    ],
  },
];

export function getWorkflowTemplate(key: string): WorkflowTemplateSpec {
  return WORKFLOW_TEMPLATES.find((t) => t.key === key) ?? WORKFLOW_TEMPLATES[0];
}

export const NODE_WIDTH = 220;
export const NODE_HEIGHT = 76;

/** Smooth cubic bezier SVG path connecting parent bottom anchor to child top anchor. */
export function edgeBezierPath(from: WorkflowNode, to: WorkflowNode): string {
  const x1 = from.x + NODE_WIDTH / 2;
  const y1 = from.y + NODE_HEIGHT;
  const x2 = to.x + NODE_WIDTH / 2;
  const y2 = to.y;
  const dy = Math.max(28, Math.abs(y2 - y1) * 0.5);
  return `M ${x1} ${y1} C ${x1} ${y1 + dy}, ${x2} ${y2 - dy}, ${x2} ${y2}`;
}

export function edgeLabelPoint(from: WorkflowNode, to: WorkflowNode): { x: number; y: number } {
  const x1 = from.x + NODE_WIDTH / 2;
  const y1 = from.y + NODE_HEIGHT;
  const x2 = to.x + NODE_WIDTH / 2;
  const y2 = to.y;
  return {
    x: (x1 + x2) / 2,
    y: (y1 + y2) / 2 - 4,
  };
}

export function nextNodePosition(nodes: WorkflowNode[]): { x: number; y: number } {
  if (nodes.length === 0) return { x: 220, y: 28 };
  const maxY = Math.max(...nodes.map((n) => n.y));
  return { x: 220, y: maxY + 118 };
}

export interface WorkflowSimStep {
  nodeId: string;
  kind: WorkflowNodeKind;
  label: string;
  detail: string;
  status: 'ok' | 'branch_yes' | 'branch_no' | 'handoff';
}

export interface WorkflowSimResult {
  visitedIds: string[];
  pathSummary: string;
  stepsExecuted: WorkflowSimStep[];
  outcome: 'resolved' | 'handed_off' | 'completed';
}

/** Deterministic graph walk used by both test runner UI and unit tests. */
export function simulateWorkflowPath(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  input: {
    message: string;
    hasOrderNumber?: boolean;
    confidence?: number;
  },
): WorkflowSimResult {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const incomingCount = new Map<string, number>();
  for (const e of edges) {
    incomingCount.set(e.to, (incomingCount.get(e.to) ?? 0) + 1);
  }

  const startNode =
    nodes.find((n) => n.kind === 'Trigger') ??
    nodes.find((n) => (incomingCount.get(n.id) ?? 0) === 0) ??
    nodes[0];

  if (!startNode) {
    return { visitedIds: [], pathSummary: 'Empty workflow', stepsExecuted: [], outcome: 'completed' };
  }

  const detectedOrder =
    typeof input.hasOrderNumber === 'boolean'
      ? input.hasOrderNumber
      : /(?:ORD-\d+|#\d{3,})/i.test(input.message);
  const confidence = typeof input.confidence === 'number' ? input.confidence : detectedOrder ? 0.91 : 0.82;

  const visited = new Set<string>();
  const visitedIds: string[] = [];
  const stepsExecuted: WorkflowSimStep[] = [];
  let outcome: WorkflowSimResult['outcome'] = 'completed';

  let current: WorkflowNode | undefined = startNode;
  while (current && !visited.has(current.id) && visitedIds.length < 25) {
    const node: WorkflowNode = current;
    visited.add(node.id);
    visitedIds.push(node.id);

    const outgoing: WorkflowEdge[] = edges.filter((e) => e.from === node.id);
    if (node.kind === 'Condition') {
      const field: string = String(node.config?.field || '');
      const minConf: number = Number(node.config?.value ?? 0.75);
      const passed: boolean =
        field === 'order_number'
          ? detectedOrder
          : field === 'ai_confidence'
            ? confidence >= (Number.isFinite(minConf) ? minConf : 0.75)
            : input.message.trim().length > 0;
      const chosenEdge: WorkflowEdge | undefined =
        outgoing.find((e) => e.condition === (passed ? 'yes' : 'no')) ?? outgoing[0];
      stepsExecuted.push({
        nodeId: node.id,
        kind: node.kind,
        label: node.label,
        detail: passed ? 'Condition matched -> Yes branch' : 'Condition not matched -> No branch',
        status: passed ? 'branch_yes' : 'branch_no',
      });
      current = chosenEdge ? byId.get(chosenEdge.to) : undefined;
      continue;
    }

    if (node.kind === 'Handoff') {
      outcome = 'handed_off';
      stepsExecuted.push({
        nodeId: node.id,
        kind: node.kind,
        label: node.label,
        detail: `Routed to ${String(node.config?.team || 'Support queue')}`,
        status: 'handoff',
      });
    } else if (node.kind === 'Action') {
      outcome = 'resolved';
      stepsExecuted.push({
        nodeId: node.id,
        kind: node.kind,
        label: node.label,
        detail: String(node.config?.template || node.subtitle || 'Action completed'),
        status: 'ok',
      });
    } else {
      stepsExecuted.push({
        nodeId: node.id,
        kind: node.kind,
        label: node.label,
        detail: node.subtitle || `${node.kind} executed`,
        status: 'ok',
      });
    }

    const nextEdge: WorkflowEdge | undefined = outgoing.find((e) => e.condition !== 'no');
    current = nextEdge ? byId.get(nextEdge.to) : undefined;
  }

  return {
    visitedIds,
    pathSummary: stepsExecuted.map((s) => s.label).join(' -> '),
    stepsExecuted,
    outcome,
  };
}
