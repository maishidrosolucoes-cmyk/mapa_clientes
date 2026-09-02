/*
 * Configuracao publica do frontend MHS.
 *
 * Pode ser editada durante a manutencao. Tudo neste arquivo fica visivel
 * para quem abrir o site, portanto use somente chaves publicas/restritas.
 *
 * Nunca coloque aqui:
 * - service_role / secret key do Supabase;
 * - senha do banco;
 * - chave server-side do Google Geocoding;
 * - tokens administrativos.
 */
window.MAPA_CLIENTES_CONFIG = Object.freeze({
  PROFILE: "maintenance",

  // Supabase: URL do projeto e chave publishable/anon.
  SUPABASE_URL: "https://pwmgbaxywvyyfmlkygqr.supabase.co",
  SUPABASE_PUBLISHABLE_KEY:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3bWdiYXh5d3Z5eWZtbGt5Z3FyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNDI3NDAsImV4cCI6MjA5MjkxODc0MH0.kSYonDj0VBHjMZuVlGeVQjAuMmbEBMQfB4OsBcZOecg",

  SUPABASE_SCHEMA: "mapa_clientes",
  SUPABASE_TABLE: "base_mapa",
  SUPABASE_PAGE_SIZE: 1000,

  // Nome da Edge Function autenticada que transforma coordenadas em endereco.
  // A funcao usa Nominatim/OpenStreetMap apenas ao confirmar um ponto.
  // Depois de publicar a funcao correspondente, mantenha este valor.
  // Use string vazia somente se optar pela browser key como alternativa.
  // A URL publicada no Supabase atualmente e /functions/v1/smart-action.
  // O nome visual pode ser alterado no Dashboard, mas esta chave deve usar o slug da URL.
  REVERSE_GEOCODING_FUNCTION: "smart-action",

  // Alternativa opcional de desenvolvimento para sugerir endereco no navegador.
  // Na operacao normal, deixe vazia: a Edge Function nao expoe chave alguma.
  // Se preencher, use exclusivamente uma browser key restrita por dominio e
  // pela Maps JavaScript API.
  GOOGLE_MAPS_BROWSER_KEY: "",
  GOOGLE_MAPS_MAP_ID: ""
});
