import { createClient } from "npm:@supabase/supabase-js@2";

type PendingClient = {
  cnpj: string;
  razao_social: string | null;
  nome_fantasia: string | null;
  endereco_busca: string | null;
  logradouro: string | null;
  bairro: string | null;
  municipio: string | null;
  uf: string | null;
  cep: string | null;
  google_geocode_attempts: number | null;
};

type GeocodeResult = {
  cnpj: string;
  accepted: boolean;
  status: string;
  dryRun: boolean;
  message?: string;
  placeId?: string;
  formattedAddress?: string;
  locationType?: string;
  latitude?: number;
  longitude?: number;
};

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8"
};

const MAX_BATCH_SIZE = 50;
const DEFAULT_BATCH_SIZE = 10;
const REQUEST_DELAY_MS = 120;

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return json({ ok: true });
    }

    if (req.method !== "POST") {
      return json({ error: "Use POST." }, 405);
    }

    const adminToken = Deno.env.get("GEOCODING_ADMIN_TOKEN") || "";
    if (!adminToken || req.headers.get("x-geocode-token") !== adminToken) {
      return json({ error: "Nao autorizado." }, 401);
    }

    const googleKey = Deno.env.get("GOOGLE_GEOCODING_API_KEY") || "";
    if (!googleKey) {
      return json({ error: "GOOGLE_GEOCODING_API_KEY nao configurada." }, 500);
    }

    const body = await safeJson(req);
    const dryRun = body.dryRun !== false;
    const requestedLimit = Number(body.limit || DEFAULT_BATCH_SIZE);
    const envLimit = Number(Deno.env.get("GEOCODING_BATCH_SIZE") || MAX_BATCH_SIZE);
    const limit = clamp(requestedLimit, 1, Math.min(envLimit, MAX_BATCH_SIZE));
    const cnpjs = Array.isArray(body.cnpjs)
      ? body.cnpjs.map((value: unknown) => String(value).trim()).filter(Boolean)
      : [];

    const supabase = createClient(
      requiredEnv("SUPABASE_URL"),
      getSupabaseAdminKey(),
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    );

    let query = supabase
      .schema("mapa_clientes")
      .from("vw_google_geocode_pendentes")
      .select("cnpj, razao_social, nome_fantasia, endereco_busca, logradouro, bairro, municipio, uf, cep, google_geocode_attempts")
      .limit(limit);

    if (cnpjs.length) {
      query = query.in("cnpj", cnpjs);
    }

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data || []) as PendingClient[];
    const results: GeocodeResult[] = [];

    for (const row of rows) {
      const result = await geocodeOne(row, googleKey, dryRun, supabase);
      results.push(result);
      await delay(REQUEST_DELAY_MS);
    }

    return json({
      ok: true,
      dryRun,
      requested: rows.length,
      accepted: results.filter((item) => item.accepted).length,
      rejected: results.filter((item) => !item.accepted).length,
      results
    });
  } catch (error) {
    console.error("[geocode-clientes]", error);
    return json(
      {
        error: error instanceof Error ? error.message : "Erro inesperado."
      },
      500
    );
  }
});

async function geocodeOne(
  row: PendingClient,
  googleKey: string,
  dryRun: boolean,
  supabase: ReturnType<typeof createClient>
): Promise<GeocodeResult> {
  const address = buildAddress(row);
  if (!address) {
    const result = {
      cnpj: row.cnpj,
      accepted: false,
      status: "SEM_ENDERECO",
      dryRun,
      message: "Registro sem endereco suficiente."
    };
    if (!dryRun) await markFailure(supabase, row, result.status, result.message);
    return result;
  }

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", address);
  url.searchParams.set("components", "country:BR");
  url.searchParams.set("region", "br");
  url.searchParams.set("key", googleKey);

  const response = await fetch(url);
  if (!response.ok) {
    const message = `Google HTTP ${response.status}`;
    if (!dryRun) await markFailure(supabase, row, "ERRO_TEMPORARIO", message, address);
    return {
      cnpj: row.cnpj,
      accepted: false,
      status: "ERRO_TEMPORARIO",
      dryRun,
      message
    };
  }

  const payload = await response.json();
  const status = String(payload.status || "");

  if (status !== "OK" || !Array.isArray(payload.results) || !payload.results[0]) {
    const mapped = status === "ZERO_RESULTS" ? "ZERO_RESULTS" : "ERRO_TEMPORARIO";
    const message = String(payload.error_message || status || "Sem resultado.");
    if (!dryRun) await markFailure(supabase, row, mapped, message, address);
    return {
      cnpj: row.cnpj,
      accepted: false,
      status: mapped,
      dryRun,
      message
    };
  }

  const best = payload.results[0];
  const validation = validateResult(row, best);

  if (!validation.ok) {
    if (!dryRun) {
      await markFailure(
        supabase,
        row,
        "VALIDACAO_FALHOU",
        validation.message,
        address
      );
    }

    return {
      cnpj: row.cnpj,
      accepted: false,
      status: "VALIDACAO_FALHOU",
      dryRun,
      message: validation.message
    };
  }

  const location = best.geometry?.location;
  const locationType = String(best.geometry?.location_type || "");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const result: GeocodeResult = {
    cnpj: row.cnpj,
    accepted: true,
    status: "OK",
    dryRun,
    placeId: String(best.place_id || ""),
    formattedAddress: String(best.formatted_address || ""),
    locationType,
    latitude: Number(location.lat),
    longitude: Number(location.lng)
  };

  if (!dryRun) {
    const { error } = await supabase
      .schema("mapa_clientes")
      .from("base_mapa")
      .update({
        google_place_id: result.placeId || null,
        google_latitude: String(result.latitude),
        google_longitude: String(result.longitude),
        google_location_type: locationType || null,
        google_formatted_address: result.formattedAddress || null,
        google_geocode_status: "OK",
        google_geocoded_at: now.toISOString(),
        google_geocode_expires_at: expiresAt.toISOString(),
        google_geocode_attempts: nextAttempt(row),
        google_geocode_error: null,
        google_geocode_source_address: address,
        google_geocode_validated: true,
        google_geocode_validation_note: validation.message
      })
      .eq("cnpj", row.cnpj);

    if (error) throw error;
  }

  return result;
}

function buildAddress(row: PendingClient) {
  return compact([
    row.endereco_busca,
    !row.endereco_busca
      ? compact([row.logradouro, row.bairro, row.municipio, row.uf, row.cep, "Brasil"]).join(", ")
      : ""
  ])[0] || "";
}

function validateResult(row: PendingClient, result: Record<string, unknown>) {
  const components = Array.isArray(result.address_components)
    ? result.address_components as Array<Record<string, unknown>>
    : [];

  const country = componentShort(components, "country");
  if (country !== "BR") {
    return { ok: false, message: `Pais divergente: ${country || "vazio"}.` };
  }

  const state = componentShort(components, "administrative_area_level_1");
  const expectedUf = normalize(row.uf);
  if (expectedUf && normalize(state) !== expectedUf) {
    return { ok: false, message: `UF divergente: ${state || "vazio"}.` };
  }

  const expectedCity = normalize(row.municipio);
  const cityCandidates = [
    componentLong(components, "administrative_area_level_2"),
    componentLong(components, "locality"),
    componentLong(components, "administrative_area_level_3")
  ].map(normalize).filter(Boolean);

  if (expectedCity && !cityCandidates.includes(expectedCity)) {
    return {
      ok: false,
      message: `Municipio divergente. Esperado ${row.municipio}; retornado ${cityCandidates.join(" / ") || "vazio"}.`
    };
  }

  const location = (result.geometry as Record<string, unknown> | undefined)?.location as
    | Record<string, unknown>
    | undefined;
  const lat = Number(location?.lat);
  const lng = Number(location?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !isPointInBrazil(lat, lng)) {
    return { ok: false, message: "Coordenada fora do Brasil ou invalida." };
  }

  return { ok: true, message: "Resultado validado por pais, UF e municipio." };
}

async function markFailure(
  supabase: ReturnType<typeof createClient>,
  row: PendingClient,
  status: string,
  message: string,
  sourceAddress = ""
) {
  const { error } = await supabase
    .schema("mapa_clientes")
    .from("base_mapa")
    .update({
      google_geocode_status: status,
      google_geocode_attempts: nextAttempt(row),
      google_geocode_error: message,
      google_geocode_source_address: sourceAddress || null,
      google_geocode_validated: false,
      google_geocode_validation_note: message
    })
    .eq("cnpj", row.cnpj);

  if (error) throw error;
}

function nextAttempt(row: PendingClient) {
  return Number(row.google_geocode_attempts || 0) + 1;
}

function getSupabaseAdminKey() {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;

  const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (secretKeys) {
    const parsed = JSON.parse(secretKeys);
    if (parsed?.default) return parsed.default;
  }

  throw new Error("Chave administrativa do Supabase nao configurada.");
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} nao configurado.`);
  return value;
}

async function safeJson(req: Request) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: JSON_HEADERS
  });
}

function componentShort(components: Array<Record<string, unknown>>, type: string) {
  return String(findComponent(components, type)?.short_name || "");
}

function componentLong(components: Array<Record<string, unknown>>, type: string) {
  return String(findComponent(components, type)?.long_name || "");
}

function findComponent(components: Array<Record<string, unknown>>, type: string) {
  return components.find((component) =>
    Array.isArray(component.types) && component.types.includes(type)
  );
}

function compact(values: Array<unknown>) {
  return values.map((value) => String(value || "").trim()).filter((value) => value && value !== "13");
}

function normalize(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function isPointInBrazil(lat: number, lng: number) {
  return lat >= -34.2 && lat <= 5.4 && lng >= -74.1 && lng <= -32.2;
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
