export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatTurn {
  question: string;
  answer?: string;
  error?: string;
  pending?: boolean;
}

export interface ConceptMapNode {
  id: string;
  label: string;
  detail: string;
}

export interface ConceptMapConnection {
  from: string;
  to: string;
  relationship: string;
}

export interface ConceptMap {
  title: string;
  nodes: ConceptMapNode[];
  connections: ConceptMapConnection[];
}
