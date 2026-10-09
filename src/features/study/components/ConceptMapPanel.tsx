"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { ConceptMap } from "@/features/study/types";

interface ConceptMapPanelProps {
  documentId: string;
}

interface Point {
  x: number;
  y: number;
}

interface DragState {
  id: string;
  pointerX: number;
  pointerY: number;
}

interface PanState {
  pointerX: number;
  pointerY: number;
  offsetX: number;
  offsetY: number;
}

const INITIAL_OFFSET = { x: 0, y: 0 };

function createMapLayout(map: ConceptMap) {
  const children = new Map<string, string[]>();
  const adjacency = new Map<string, Set<string>>();
  const nodesById = new Set(map.nodes.map((node) => node.id));

  for (const node of map.nodes) adjacency.set(node.id, new Set());
  for (const connection of map.connections) {
    if (!nodesById.has(connection.from) || !nodesById.has(connection.to)) continue;
    adjacency.get(connection.from)?.add(connection.to);
    adjacency.get(connection.to)?.add(connection.from);
  }

  const root = map.nodes[0];
  if (!root) return { positions: {}, children };

  const visited = new Set([root.id]);
  const levels: string[][] = [[root.id]];
  const queue = [root.id];

  while (queue.length) {
    const parent = queue.shift();
    if (!parent) continue;
    for (const child of adjacency.get(parent) ?? []) {
      if (visited.has(child)) continue;
      visited.add(child);
      queue.push(child);
      const level = levels.findIndex((ids) => ids.includes(parent)) + 1;
      (levels[level] ??= []).push(child);
      const siblings = children.get(parent) ?? [];
      siblings.push(child);
      children.set(parent, siblings);
    }
  }

  for (const node of map.nodes) {
    if (!visited.has(node.id)) {
      levels.push([node.id]);
      visited.add(node.id);
    }
  }

  const positions: Record<string, Point> = {};
  levels.forEach((ids, levelIndex) => {
    const y = levels.length === 1 ? 50 : 13 + levelIndex * (74 / (levels.length - 1));
    ids.forEach((id, index) => {
      positions[id] = {
        x: ids.length === 1 ? 50 : 12 + (76 * index) / (ids.length - 1),
        y,
      };
    });
  });

  return { positions, children };
}

export default function ConceptMapPanel({ documentId }: ConceptMapPanelProps) {
  const [conceptMap, setConceptMap] = useState<ConceptMap | null>(null);
  const [positions, setPositions] = useState<Record<string, Point>>({});
  const [children, setChildren] = useState<Map<string, string[]>>(new Map());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState(INITIAL_OFFSET);
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const panRef = useRef<PanState | null>(null);

  useEffect(() => {
    const element = stageRef.current;
    if (!element) return;

    function handleWheel(event: WheelEvent) {
      event.preventDefault();
      const stage = stageRef.current;
      if (!stage) return;
      const rect = stage.getBoundingClientRect();
      const pointerX = event.clientX - rect.left;
      const pointerY = event.clientY - rect.top;
      setZoom((currentZoom) => {
        const nextZoom = Math.min(
          2,
          Math.max(0.55, currentZoom * (event.deltaY < 0 ? 1.12 : 0.89)),
        );
        const scale = nextZoom / currentZoom;
        setOffset((currentOffset) => ({
          x: pointerX - (pointerX - currentOffset.x) * scale,
          y: pointerY - (pointerY - currentOffset.y) * scale,
        }));
        return nextZoom;
      });
    }

    element.addEventListener("wheel", handleWheel, { passive: false });
    return () => element.removeEventListener("wheel", handleWheel);
  }, [conceptMap]);

  async function generateMap() {
    setIsGenerating(true);
    setError(null);
    try {
      const response = await fetch(`/api/documents/${documentId}/concept-map`, { method: "POST" });
      const result = (await response.json()) as { conceptMap?: ConceptMap; error?: string };
      if (!response.ok || !result.conceptMap) {
        throw new Error(result.error ?? "StudyBud couldn't create a concept map. Please try again.");
      }
      const layout = createMapLayout(result.conceptMap);
      setConceptMap(result.conceptMap);
      setPositions(layout.positions);
      setChildren(layout.children);
      setCollapsed(new Set());
      setZoom(1);
      setOffset(INITIAL_OFFSET);
    } catch (generationError) {
      setError(
        generationError instanceof Error
          ? generationError.message
          : "StudyBud couldn't create a concept map. Please try again.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  function visibleNodeIds() {
    const hidden = new Set<string>();
    const hideDescendants = (id: string) => {
      for (const child of children.get(id) ?? []) {
        if (hidden.has(child)) continue;
        hidden.add(child);
        hideDescendants(child);
      }
    };
    collapsed.forEach(hideDescendants);
    return new Set(conceptMap?.nodes.map((node) => node.id).filter((id) => !hidden.has(id)) ?? []);
  }

  function getMapPoint(clientX: number, clientY: number): Point | null {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: Math.max(4, Math.min(96, ((clientX - rect.left - offset.x) / (rect.width * zoom)) * 100)),
      y: Math.max(7, Math.min(93, ((clientY - rect.top - offset.y) / (rect.height * zoom)) * 100)),
    };
  }

  function startNodeDrag(event: PointerEvent<HTMLElement>, id: string) {
    if ((event.target as HTMLElement).closest("button")) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { id, pointerX: event.clientX, pointerY: event.clientY };
  }

  function movePointer(event: PointerEvent<HTMLDivElement>) {
    if (dragRef.current) {
      const drag = dragRef.current;
      const point = getMapPoint(event.clientX, event.clientY);
      if (!point) return;
      setPositions((current) => ({ ...current, [drag.id]: point }));
      dragRef.current = { ...drag, pointerX: event.clientX, pointerY: event.clientY };
      return;
    }
    if (panRef.current) {
      const pan = panRef.current;
      setOffset({
        x: pan.offsetX + event.clientX - pan.pointerX,
        y: pan.offsetY + event.clientY - pan.pointerY,
      });
    }
  }

  function startPan(event: PointerEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("[data-map-node]")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    panRef.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      offsetX: offset.x,
      offsetY: offset.y,
    };
  }

  function endPointer() {
    dragRef.current = null;
    panRef.current = null;
  }

  function toggleBranch(id: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const visibleIds = visibleNodeIds();
  const visibleConnections =
    conceptMap?.connections.filter(
      (connection) => visibleIds.has(connection.from) && visibleIds.has(connection.to),
    ) ?? [];

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_3px_18px_-12px_rgba(15,23,42,0.24)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-indigo-600">
            Visual learning
          </p>
          <h2 className="mt-1 text-sm font-bold text-slate-950">Interactive mind map</h2>
        </div>
        <div className="flex items-center gap-2">
          {conceptMap && (
            <div className="flex items-center rounded-lg border border-slate-200 bg-white">
              <button
                type="button"
                onClick={() => setZoom((value) => Math.max(0.55, value - 0.15))}
                aria-label="Zoom out"
                className="h-8 w-8 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                −
              </button>
              <span className="min-w-12 text-center text-[10px] font-medium text-slate-500">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoom((value) => Math.min(2, value + 0.15))}
                aria-label="Zoom in"
                className="h-8 w-8 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                +
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={generateMap}
            disabled={isGenerating}
            className="min-h-9 shrink-0 rounded-lg bg-indigo-600 px-3 text-[11px] font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 sm:text-xs"
          >
            {isGenerating ? "Building..." : conceptMap ? "Regenerate" : "Create mind map"}
          </button>
        </div>
      </div>

      <div className="p-3 sm:p-4">
        {isGenerating && (
          <p role="status" className="mb-3 rounded-lg bg-indigo-50 p-3 text-xs text-indigo-800">
            StudyBud is connecting the main ideas in your notes...
          </p>
        )}
        {error && (
          <p role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-xs leading-5 text-red-700">
            {error}
          </p>
        )}
        {!conceptMap && !isGenerating && !error && (
          <div className="flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 px-5 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 text-xl text-indigo-700" aria-hidden="true">✣</span>
            <p className="mt-3 text-sm font-semibold text-slate-800">Explore how your ideas connect</p>
            <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">
              Generate a map, then drag concepts into place, pan around, zoom in, or collapse branches.
            </p>
          </div>
        )}

        {conceptMap && (
          <>
            <p className="mb-2 truncate text-xs font-semibold text-slate-700">{conceptMap.title}</p>
            <div
              ref={stageRef}
              role="application"
              aria-label="Interactive mind map. Drag a concept to move it, drag the background to pan, and use the controls to zoom."
              className="relative h-[min(66vh,620px)] min-h-[340px] touch-none select-none overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
              onPointerDown={startPan}
              onPointerMove={movePointer}
              onPointerUp={endPointer}
              onPointerCancel={endPointer}
              style={{
                backgroundImage: "radial-gradient(#cbd5e1 0.7px, transparent 0.7px)",
                backgroundSize: "18px 18px",
                cursor: panRef.current ? "grabbing" : "grab",
              }}
            >
              <div
                className="absolute inset-0"
                style={{
                  transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                  transformOrigin: "top left",
                }}
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
                >
                  <defs>
                    <marker id="mindmap-arrow" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto">
                      <path d="M0,0 L5,2.5 L0,5 z" fill="#818cf8" />
                    </marker>
                  </defs>
                  {visibleConnections.map((connection, index) => {
                    const from = positions[connection.from];
                    const to = positions[connection.to];
                    if (!from || !to) return null;
                    return (
                      <g key={`${connection.from}-${connection.to}-${index}`}>
                        <line
                          x1={`${from.x}%`}
                          y1={`${from.y}%`}
                          x2={`${to.x}%`}
                          y2={`${to.y}%`}
                          stroke="#a5b4fc"
                          strokeWidth="0.28"
                          markerEnd="url(#mindmap-arrow)"
                          vectorEffect="non-scaling-stroke"
                        />
                        <text
                          x={`${(from.x + to.x) / 2}%`}
                          y={`${(from.y + to.y) / 2}%`}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          className="fill-slate-500"
                          style={{ fontSize: "2px" }}
                        >
                          {connection.relationship}
                        </text>
                      </g>
                    );
                  })}
                </svg>

                {conceptMap.nodes.map((node, index) => {
                  if (!visibleIds.has(node.id)) return null;
                  const point = positions[node.id] ?? { x: 50, y: 50 };
                  const hasChildren = (children.get(node.id)?.length ?? 0) > 0;
                  const isRoot = index === 0;
                  return (
                    <article
                      key={node.id}
                      data-map-node
                      className={`absolute flex w-[clamp(112px,27%,190px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border bg-white p-2.5 text-left shadow-[0_8px_24px_-16px_rgba(15,23,42,0.35)] sm:p-3 ${
                        isRoot
                          ? "border-indigo-300 ring-2 ring-indigo-100"
                          : "border-slate-200 hover:border-indigo-200"
                      }`}
                      style={{ left: `${point.x}%`, top: `${point.y}%`, cursor: "grab" }}
                      onPointerDown={(event) => startNodeDrag(event, node.id)}
                    >
                      <div className="flex min-w-0 items-start justify-between gap-1.5">
                        <h3 className="line-clamp-2 text-[11px] font-bold leading-4 text-slate-900 sm:text-xs">
                          {node.label}
                        </h3>
                        {hasChildren && (
                          <button
                            type="button"
                            onPointerDown={(event) => event.stopPropagation()}
                            onClick={() => toggleBranch(node.id)}
                            aria-expanded={!collapsed.has(node.id)}
                            aria-label={`${collapsed.has(node.id) ? "Expand" : "Collapse"} ${node.label} branch`}
                            title={`${collapsed.has(node.id) ? "Expand" : "Collapse"} branch`}
                            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-indigo-50 text-xs font-bold text-indigo-700 hover:bg-indigo-100"
                          >
                            {collapsed.has(node.id) ? "+" : "−"}
                          </button>
                        )}
                      </div>
                      <p className="mt-1 line-clamp-3 text-[10px] leading-4 text-slate-600">
                        {node.detail}
                      </p>
                      {hasChildren && (
                        <span className="mt-1 text-[9px] font-medium text-indigo-600">
                          {collapsed.has(node.id) ? "Branch collapsed" : "Drag to rearrange"}
                        </span>
                      )}
                    </article>
                  );
                })}
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500">
              <span>Drag a concept to move it · drag empty space to pan · scroll to zoom</span>
              <button
                type="button"
                onClick={() => {
                  const layout = createMapLayout(conceptMap);
                  setPositions(layout.positions);
                  setChildren(layout.children);
                  setCollapsed(new Set());
                  setZoom(1);
                  setOffset(INITIAL_OFFSET);
                }}
                className="font-semibold text-indigo-600 hover:text-indigo-800"
              >
                Reset layout
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
