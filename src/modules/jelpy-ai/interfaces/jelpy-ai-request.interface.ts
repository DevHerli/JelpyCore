export interface JelpyAiRequest {
  text: string;
  city_hint?: string | null;
  lat?: number | null;
  lng?: number | null;
  user_id?: number | null;
}