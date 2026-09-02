import { createClient } from "npm:@supabase/supabase-js@2";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS"
};

const EDITOR_ROLES = ["ADMIN", "MANUTENCAO", "EDITOR"];
const PROVIDER = "NOMINATIM";
const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/reverse";
const NOMINATIM_TIMEOUT_MS = 10_000;
const NOMINATIM_MIN_INTERVAL_MS = 1_100;
const CACHE_DECIMALS = 5;
const CACHE_SUCCESS_DAYS = 30;
const CACHE_MISS_DAYS = 1;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({ ok: true });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);

  try {
    const token = (req.headers.get("Authorization") || "")
      .replace(/^Bearer\s+/i, "")
      .trim();
    if (!token) return json({ error: "Usuario nao autenticado." }, 401);

    const supabase = createClient(requiredEnv("SUPABASE_URL"), getSupabaseAdminKey(), {
      auth: { persistSession: false, autoRefreshToken: false }
    });

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) return json({ error: "Sessao invalida." }, 401);

    const { data: operator, error: operatorError } = await supabase
      .schema("mapa_clientes")
      .from("operadores")
      .select("papel, ativo")
      .eq("usuario_id", userData.user.id)
      .eq("ativo", true)
      .maybeSingle();

    if (operatorError) throw operatorError;
    if (!operator || !EDITOR_ROLES.includes(clean(operator.papel).toUpperCase())) {
      return json({ error: "Operador nao autorizado." }, 403);
    }

    const body = await safeJson(req);
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    if (!isPointInBrazil(latitude, longitude)) {
      return json({ error: "Coordenada fora dos limites do Brasil." }, 400);
    }

    const cacheKey = {
      latitude: latitude.toFixed(CACHE_DECIMALS),
      longitude: longitude.toFixed(CACHE_DECIMALS)
    };
    const cached = await readCachedSuggestion(supabase, cacheKey);
    if (cached) return json({ ok: true, ...cached, cached: true });

    const waitMs = await reserveNominatimRequest(supabase);
    if (waitMs > 0) {
      return json(
        {
          error: "Aguarde um instante e consulte novamente o endereco.",
          retryAfterMs: waitMs
        },
        429
      );
    }

    const suggestion = await requestNominatim(req, latitude, longitude);
    await cacheSuggestion(supabase, cacheKey, suggestion);
    return json({ ok: true, ...suggestion, cached: false });
  } catch (error) {
    console.error("[reverse-geocode-ponto]", error);
    return json(
      { error: error instanceof Error ? error.message : "Erro inesperado." },
      500
    );
  }
});

async function readCachedSuggestion(
  supabase: ReturnType<typeof createClient>,
  cacheKey: { latitude: string; longitude: string }
) {
  const { data, error } = await supabase
    .schema("mapa_clientes")
    .from("cache_enderecos_reversos")
    .select("encontrado, resultado")
    .eq("provedor", PROVIDER)
    .eq("latitude_chave", cacheKey.latitude)
    .eq("longitude_chave", cacheKey.longitude)
    .gt("expira_em", new Date().toISOString())
    .maybeSingle();

  if (error) {
    throw new Error("Cache de endereco nao configurado. Execute o SQL de geocodificacao reversa.");
  }
  if (!data) return null;
  if (!data.encontrado) return emptySuggestion();
  return isSuggestion(data.resultado) ? data.resultado : null;
}

async function reserveNominatimRequest(supabase: ReturnType<typeof createClient>) {
  const { data, error } = await supabase
    .schema("mapa_clientes")
    .rpc("reservar_consulta_reversa", {
      p_provedor: PROVIDER,
      p_intervalo_ms: NOMINATIM_MIN_INTERVAL_MS
    });

  if (error) {
    throw new Error("Controle de consultas nao configurado. Execute o SQL de geocodificacao reversa.");
  }
  return Math.max(0, Number(data) || 0);
}

async function requestNominatim(req: Request, latitude: number, longitude: number) {
  const url = new URL(NOMINATIM_ENDPOINT);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("zoom", "18");
  url.searchParams.set("layer", "address");
  url.searchParams.set("accept-language", "pt-BR");

  const appOrigin = getApplicationOrigin(req);
  const response = await fetchWithTimeout(url, NOMINATIM_TIMEOUT_MS, {
    accept: "application/json",
    "accept-language": "pt-BR,pt;q=0.9",
    "user-agent": `MHS-MapaClientes-Feira/1.0 (+${appOrigin})`,
    referer: `${appOrigin}/`
  });

  if (response.status === 404) return emptySuggestion();
  if (response.status === 429) {
    throw new Error("Servico de endereco temporariamente ocupado. Tente novamente em alguns segundos.");
  }
  if (!response.ok) throw new Error(`Servico de endereco HTTP ${response.status}.`);

  const payload = await response.json();
  if (clean(payload?.address?.country_code).toLowerCase() !== "br") return emptySuggestion();

  const formattedAddress = clean(payload?.display_name);
  const address = extractAddress(payload?.address);
  if (!formattedAddress && !Object.values(address).some(Boolean)) return emptySuggestion();

  return {
    provider: "NOMINATIM" as const,
    attribution: "Dados © OpenStreetMap contributors · Nominatim",
    formattedAddress,
    address
  };
}

async function cacheSuggestion(
  supabase: ReturnType<typeof createClient>,
  cacheKey: { latitude: string; longitude: string },
  suggestion: Suggestion
) {
  const found = Boolean(
    suggestion.formattedAddress || Object.values(suggestion.address || {}).some(Boolean)
  );
  const expiresAt = new Date();
  expiresAt.setUTCDate(expiresAt.getUTCDate() + (found ? CACHE_SUCCESS_DAYS : CACHE_MISS_DAYS));

  const { error } = await supabase
    .schema("mapa_clientes")
    .from("cache_enderecos_reversos")
    .upsert(
      {
        provedor: PROVIDER,
        latitude_chave: cacheKey.latitude,
        longitude_chave: cacheKey.longitude,
        encontrado: found,
        resultado: found ? suggestion : null,
        consultado_em: new Date().toISOString(),
        expira_em: expiresAt.toISOString()
      },
      { onConflict: "provedor,latitude_chave,longitude_chave" }
    );

  if (error) throw new Error("Nao foi possivel salvar o cache do endereco.");
}

type Address = {
  logradouro: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
};

type Suggestion = {
  provider: "NOMINATIM";
  attribution: string;
  formattedAddress: string;
  address: Address | null;
};

function emptySuggestion(): Suggestion {
  return {
    provider: "NOMINATIM",
    attribution: "Dados © OpenStreetMap contributors · Nominatim",
    formattedAddress: "",
    address: null
  };
}

function isSuggestion(value: unknown): value is Suggestion {
  return Boolean(value && typeof value === "object" && "provider" in value && "formattedAddress" in value);
}

function extractAddress(value: unknown): Address {
  const address = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const route = firstAddressValue(address, ["road", "pedestrian", "footway", "path"]);
  const number = clean(address.house_number);

  return {
    logradouro: [route, number].filter(Boolean).join(", "),
    bairro: firstAddressValue(address, ["neighbourhood", "suburb", "quarter", "city_district", "hamlet", "village"]),
    municipio: firstAddressValue(address, ["city", "town", "municipality", "village", "city_district"]),
    uf: extractBrazilStateCode(address),
    cep: formatCep(clean(address.postcode))
  };
}

function firstAddressValue(address: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = clean(address[key]);
    if (value) return value;
  }
  return "";
}

function extractBrazilStateCode(address: Record<string, unknown>) {
  const stateCode = clean(address["ISO3166-2-lvl4"] || address.state_code).toUpperCase();
  const match = stateCode.match(/^BR-([A-Z]{2})$/);
  if (match) return match[1];

  const states: Record<string, string> = {
    acre: "AC", alagoas: "AL", amapa: "AP", amazonas: "AM", bahia: "BA",
    ceara: "CE", "distrito federal": "DF", "espirito santo": "ES", goias: "GO",
    maranhao: "MA", "mato grosso": "MT", "mato grosso do sul": "MS",
    "minas gerais": "MG", para: "PA", paraiba: "PB", parana: "PR", pernambuco: "PE",
    piaui: "PI", "rio de janeiro": "RJ", "rio grande do norte": "RN",
    "rio grande do sul": "RS", rondonia: "RO", roraima: "RR", "santa catarina": "SC",
    "sao paulo": "SP", sergipe: "SE", tocantins: "TO"
  };
  return states[normalize(clean(address.state))] || "";
}

function formatCep(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length === 8 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : value;
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function getApplicationOrigin(req: Request) {
  const origin = clean(req.headers.get("origin"));
  try {
    const parsed = new URL(origin);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") return parsed.origin;
  } catch {
    // Usa a URL publica da funcao quando a chamada nao informa Origin.
  }
  return requiredEnv("SUPABASE_URL");
}

function getSupabaseAdminKey() {
  const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (secretKeys) {
    try {
      const parsed = JSON.parse(secretKeys);
      if (parsed?.default) return parsed.default;
    } catch {
      // Tenta a variavel legada abaixo, se existir.
    }
  }

  const legacyKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacyKey) return legacyKey;
  throw new Error("Chave administrativa do Supabase nao configurada.");
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} nao configurado.`);
  return value;
}

async function fetchWithTimeout(url: URL, timeoutMs: number, headers: HeadersInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { headers, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) throw new Error("A consulta de endereco demorou demais.");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function safeJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? body as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function isPointInBrazil(latitude: number, longitude: number) {
  return Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -34.2 && latitude <= 5.4 &&
    longitude >= -74.1 && longitude <= -32.2;
}

function clean(value: unknown) {
  return String(value || "").trim();
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}
