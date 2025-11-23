import { useCallback, useMemo, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  Position,
  Handle,
} from '@xyflow/react';
import type { Node as FlowNode, Edge, NodeProps } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { X, User, Bot } from 'lucide-react';
import type { Node } from '../types';

interface GraphViewProps {
  nodes: Node[];
  activeNodeId: string | null;
  onNodeClick: (nodeId: string) => void;
  onClose: () => void;
}

interface ChatNodeData {
  role: string;
  content: string;
  model: string | null;
  isActive: boolean;
  [key: string]: unknown;
}

// Custom node component
function ChatNode({ data, selected }: NodeProps<FlowNode<ChatNodeData>>) {
  const nodeData = data as ChatNodeData;
  const isUser = nodeData.role === 'user';
  const isActive = nodeData.isActive;

  return (
    <div
      className={`graph-node ${isUser ? 'graph-node-user' : 'graph-node-assistant'} ${
        isActive ? 'graph-node-active' : ''
      } ${selected ? 'graph-node-selected' : ''}`}
    >
      <Handle type="target" position={Position.Top} />
      <div className="graph-node-header">
        {isUser ? <User size={12} /> : <Bot size={12} />}
        <span>{isUser ? 'You' : nodeData.model || 'AI'}</span>
      </div>
      <div className="graph-node-content">
        {nodeData.content.slice(0, 100)}
        {nodeData.content.length > 100 ? '...' : ''}
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

const nodeTypes = {
  chatNode: ChatNode,
};

// Layout nodes using dagre
function getLayoutedElements(
  nodes: FlowNode[],
  edges: Edge[],
  direction = 'TB'
) {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const nodeWidth = 280;
  const nodeHeight = 120;

  dagreGraph.setGraph({ rankdir: direction, nodesep: 80, ranksep: 100 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}

export function GraphView({
  nodes: chatNodes,
  activeNodeId,
  onNodeClick,
  onClose,
}: GraphViewProps) {
  // Convert chat nodes to React Flow nodes and edges
  const { initialNodes, initialEdges } = useMemo(() => {
    const flowNodes: FlowNode[] = chatNodes.map((node) => ({
      id: node.id,
      type: 'chatNode',
      position: { x: 0, y: 0 },
      data: {
        ...node,
        isActive: node.id === activeNodeId,
      },
    }));

    const flowEdges: Edge[] = chatNodes
      .filter((node) => node.parent_id)
      .map((node) => ({
        id: `${node.parent_id}-${node.id}`,
        source: node.parent_id!,
        target: node.id,
        animated: node.id === activeNodeId,
        style: {
          stroke: node.id === activeNodeId ? 'var(--accent)' : 'var(--border)',
          strokeWidth: 2,
        },
      }));

    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      flowNodes,
      flowEdges
    );

    return { initialNodes: layoutedNodes, initialEdges: layoutedEdges };
  }, [chatNodes, activeNodeId]);

  const [flowNodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [flowEdges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes when chatNodes change
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: FlowNode) => {
      onNodeClick(node.id);
    },
    [onNodeClick]
  );

  return (
    <div className="graph-view">
      <div className="graph-header">
        <h2>
          <span className="graph-title-icon">🌌</span>
          Conversation Multiverse
        </h2>
        <p>Click any node to jump to that branch</p>
        <button className="btn-close" onClick={onClose}>
          <X size={20} />
        </button>
      </div>

      <div className="graph-container">
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.1}
          maxZoom={2}
        >
          <Background color="var(--border)" gap={20} />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}
