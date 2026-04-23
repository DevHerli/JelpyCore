export interface JelpyAiResponse {
  intent: string;
  confidence: number;
  entities: {
    categoria: string | null;
    subcategoria: string | null;
    ciudad: string | null;
    especialidad?: string | null;
  };
  filters: {
    abierto_ahora: boolean;
    promos?: boolean;
    cerca_de_mi?: boolean;
  };
  normalized_text: string;
  reply: {
    mode: 'direct_reply' | 'search';
    title?: string | null;
    message?: string | null;
    suggestions?: string[];
  };
}