'use client';

// components/graph/DependencyGraph.tsx
// Task 2.2: dependency graph view using @xyflow/react and @dagrejs/dagre.
//
// SSR safety contract:
//   - The entire component is behind a mounted guard. Nothing renders on the
//     server. React Flow reads DOM dimensions at mount time; running it during
//     SSR gives every node a zero size and collapses the layout.
//   - Dagre layout runs in a useEffect that fires only after useNodesInitialized
//     returns true, meaning React Flow has measured every node. Running dagre
//     before measurement produces the same zero-size collapse.
//
// Props: today and projectStart are injected by the caller. new Date() is
// never called inside this component, so tests can pin the date and SSR/client
// renders agree.
//
// Node text comes from the engine (node.label, node.agency, etc.).
// No regulatory text is typed into JSX.

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  useNodesInitialized,
  Background,
  Controls,
  Handle,
  Position,
  type Node,
  type Edge,
} from '@xyflow/react';
import dagre from '@dagrejs/dagre';
import '@xyflow/react/dist/style.css';

import { buildGraph } from '@/engine/graph';
import { computeCriticalPath } from '@/engine/critical-path';
import { getRegimeBadge } from '@/engine/regime';
import { REGIME_FLAG } from '@/engine/types';
import type { MissionInput, GraphNode, Verdict } from '@/engine/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// Data payload attached to each React Flow node
type MilestoneData = {
  graphNode: GraphNode;
  onCriticalPath: boolean;
};

type MilestoneNode = Node<MilestoneData, 'milestone'>;

// ---------------------------------------------------------------------------
// Verdict presentation: color token + text label (never color alone)
// ---------------------------------------------------------------------------

const VERDICT_CONFIG: Record<
  Verdict,
  { token: string; label: string; textColor: string }
> = {
  VIOLATED: {
    token: 'var(--color-violated)',
    label: 'VIOLATED',
    textColor: 'var(--color-bg)',
  },
  AT_RISK: {
    token: 'var(--color-at-risk)',
    label: 'AT RISK',
    textColor: 'var(--color-bg)',
  },
  OK: {
    token: 'var(--color-ok)',
    label: 'OK',
    textColor: 'var(--color-bg)',
  },
  ABSTAIN: {
    token: 'transparent',
    label: 'ABSTAIN',
    textColor: 'var(--color-muted)',
  },
};

// ---------------------------------------------------------------------------
// NODE_WIDTH / NODE_HEIGHT: tell dagre the rendered node dimensions so it
// can compute non-overlapping positions. The custom node renders to exactly
// these dimensions via its style.
// ---------------------------------------------------------------------------

const NODE_WIDTH = 220;
const NODE_HEIGHT = 100;

// ---------------------------------------------------------------------------
// Custom node component
// ---------------------------------------------------------------------------

function MilestoneNodeComponent({ data }: { data: MilestoneData }) {
  const { graphNode: n, onCriticalPath } = data;
  const cfg = VERDICT_CONFIG[n.verdict];
  const regimeBadge = getRegimeBadge(n);

  return (
    <div
      style={{
        width: NODE_WIDTH,
        minHeight: NODE_HEIGHT,
        backgroundColor: 'var(--color-surface)',
        border: onCriticalPath
          ? '2px solid var(--color-fg)'
          : '1px solid var(--color-border)',
        borderRadius: '4px',
        padding: '0.5rem 0.6rem',
        fontSize: '11px',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.25rem',
        boxSizing: 'border-box',
      }}

    >
            <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      {/* Top row: verdict badge (color + text label) + critical-path marker */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
        <span
          aria-label={`Verdict: ${cfg.label}`}
          style={{
            backgroundColor: cfg.token,
            color: cfg.label === 'ABSTAIN' ? 'var(--color-muted)' : cfg.textColor,
            border: cfg.label === 'ABSTAIN' ? '1px solid var(--color-border)' : 'none',
            fontSize: '9px',
            fontWeight: 700,
            letterSpacing: '0.08em',
            padding: '1px 4px',
            borderRadius: '2px',
            whiteSpace: 'nowrap',
          }}
        >
          {cfg.label}
        </span>
        {onCriticalPath && (
          <span
            aria-label="On critical path"
            style={{
              fontSize: '9px',
              fontWeight: 600,
              color: 'var(--color-muted)',
              border: '1px solid var(--color-border)',
              padding: '1px 4px',
              borderRadius: '2px',
              whiteSpace: 'nowrap',
            }}
          >
            CRITICAL
          </span>
        )}
        {n.pendingPart100 && regimeBadge && (
          <span
            aria-label={`Regime: ${regimeBadge}`}
            style={{
              fontSize: '9px',
              color: 'var(--color-muted)',
              border: '1px solid var(--color-border)',
              padding: '1px 4px',
              borderRadius: '2px',
              whiteSpace: 'nowrap',
            }}
          >
            {regimeBadge}
          </span>
        )}
      </div>

      {/* Node label: comes from the engine, never typed here */}
      <div
        style={{
          fontWeight: 600,
          color: 'var(--color-fg)',
          lineHeight: '1.3',
          fontSize: '11px',
        }}
      >
        {n.label}
      </div>

      {/* Agency + duration row */}
      <div style={{ color: 'var(--color-muted)', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <span>{n.agency}</span>
        {n.durationDays > 0 && (
          <span>
            {n.durationDays}d
            {n.durationBasis === 'ESTIMATED' && (
              <abbr
                title="Duration is an estimate, not a documented clock"
                style={{ marginLeft: '2px', textDecoration: 'underline dotted', cursor: 'help' }}
              >
                est.
              </abbr>
            )}
          </span>
        )}
      </div>

      {/* Citation: only for Part 25 nodes under the regime flag */}
      {n.pendingPart100 && n.citation && !REGIME_FLAG.part100Active && (
        <div
          style={{
            fontSize: '9px',
            color: 'var(--color-muted)',
            borderTop: '1px solid var(--color-border)',
            paddingTop: '0.2rem',
            lineHeight: '1.4',
          }}
        >
          {/* Citation text comes from the engine via node.citation */}
          {n.citation.cfrTitle} CFR {n.citation.part}.{n.citation.section}
                  {n.citation.paragraphPath}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
}


// React Flow requires the nodeTypes map to be stable across renders (referential equality).
// Define it outside the component.
const NODE_TYPES = {
  milestone: MilestoneNodeComponent,
} as const;

// ---------------------------------------------------------------------------
// Dagre layout helper
// Run AFTER React Flow has measured nodes (useNodesInitialized = true).
// Direction: top-to-bottom (TB).
// ---------------------------------------------------------------------------

function runDagreLayout(
  rfNodes: MilestoneNode[],
  rfEdges: Edge[],
): MilestoneNode[] {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'TB', ranksep: 60, nodesep: 40 });
  g.setDefaultEdgeLabel(() => ({}));

  for (const node of rfNodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const edge of rfEdges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  return rfNodes.map((node) => {
    const pos = g.node(node.id);
    return {
      ...node,
      position: {
        x: pos.x - NODE_WIDTH / 2,
        y: pos.y - NODE_HEIGHT / 2,
      },
    };
  });
}

// ---------------------------------------------------------------------------
// Inner component (must be inside ReactFlowProvider to use hooks)
// ---------------------------------------------------------------------------

interface InnerProps {
  mission: MissionInput;
  today: string;
  projectStart: string;
}

function GraphInner({ mission, today, projectStart }: InnerProps) {
  // Build graph and compute critical path (pure, synchronous)
  const { initialNodes, initialEdges } = useMemo(() => {
    const { nodes: engineNodes, edges: engineEdges } = buildGraph(mission);
    const result = computeCriticalPath(
      engineNodes,
      engineEdges,
      mission.deliveryDate,
      projectStart,
      today,
    );

    const criticalSet = new Set(result.criticalPath);

    const rfNodes: MilestoneNode[] = Array.from(result.nodes.values()).map(
      (n) => ({
        id: n.id,
        type: 'milestone' as const,
        // Start all nodes at origin; dagre will set real positions after measurement
        position: { x: 0, y: 0 },
        data: {
          graphNode: n,
          onCriticalPath: criticalSet.has(n.id),
        },
        // Disable drag/selection for this read-only view
        draggable: false,
        selectable: false,
        focusable: true,
      }),
    );

    const rfEdges: Edge[] = engineEdges.map((e) => ({
      id: `${e.from}->${e.to}`,
      source: e.from,
      target: e.to,
      style: { stroke: 'var(--color-border)', strokeWidth: 1 },
    }));

    return { initialNodes: rfNodes, initialEdges: rfEdges };
  }, [mission, today, projectStart]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  // layoutDone prevents re-running dagre on every render after the first layout
  const [layoutDone, setLayoutDone] = useState(false);

  // Re-seed nodes when mission changes (projectStart or today changes)
  useEffect(() => {
    setNodes(initialNodes);
    setLayoutDone(false);
  }, [initialNodes, setNodes]);

  // useNodesInitialized is true when React Flow has measured all node dimensions.
  // Only then can dagre produce correct non-overlapping positions.
  const nodesInitialized = useNodesInitialized();

  const applyLayout = useCallback(() => {
    if (!nodesInitialized || layoutDone) return;
    setNodes((current) => runDagreLayout(current as MilestoneNode[], edges));
    setLayoutDone(true);
  }, [nodesInitialized, layoutDone, edges, setNodes]);

  useEffect(() => {
    applyLayout();
  }, [applyLayout]);

  return (
    <div
      style={{
        width: '100%',
        height: '520px',
        backgroundColor: 'var(--color-bg)',
        border: '1px solid var(--color-border)',
        borderRadius: '4px',
      }}
      // Keep React Flow keyboard interactions scoped
      aria-label="Regulatory dependency graph"
      role="img"
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={NODE_TYPES}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.2}
        maxZoom={2}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: false }}
        colorMode="dark"
        style={{ backgroundColor: 'var(--color-bg)' }}
      >
        <Background color="var(--color-border)" gap={20} size={1} />
        <Controls
          showInteractive={false}
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
          }}
        />
      </ReactFlow>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public component: mounts only client-side to avoid SSR sizing issues
// ---------------------------------------------------------------------------

export interface DependencyGraphProps {
  mission: MissionInput;
  /** ISO date string for today. Never call new Date() inside this component. */
  today: string;
  /** ISO date string for project planning start (forward-pass anchor). */
  projectStart: string;
}

export function DependencyGraph({ mission, today, projectStart }: DependencyGraphProps) {
  // mounted guards against SSR. React Flow reads DOM dimensions on mount;
  // rendering on the server gives every node a zero size.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted) {
    return (
      <div
        style={{
          width: '100%',
          height: '520px',
          backgroundColor: 'var(--color-bg)',
          border: '1px solid var(--color-border)',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        aria-label="Dependency graph loading"
      >
        <span style={{ fontSize: '12px', color: 'var(--color-muted)' }}>
          Loading graph...
        </span>
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <GraphInner mission={mission} today={today} projectStart={projectStart} />
    </ReactFlowProvider>
  );
}
