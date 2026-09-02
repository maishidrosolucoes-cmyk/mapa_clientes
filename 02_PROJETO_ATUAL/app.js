(() => {
  "use strict";

  /*
   * ============================================================
   * CONFIGURAÇÃO
   * ============================================================
   * 1) Execute supabase_mapa_clientes.sql e importe o CSV
   *    para mapa_clientes.base_mapa.
   * 2) Cole sua chave ANON/PUBLISHABLE abaixo.
   * 3) Para chaves JWT antigas, o projeto geralmente é identificado
   *    automaticamente pelo campo "ref" da chave.
   * 4) Para chaves "sb_publishable_...", informe também SUPABASE_URL.
   */
  const RUNTIME_CONFIG = window.MAPA_CLIENTES_CONFIG || {};
  const CONFIG = Object.freeze({
    PROFILE: String(RUNTIME_CONFIG.PROFILE || "production").trim(),
    SUPABASE_URL: String(RUNTIME_CONFIG.SUPABASE_URL || "").trim(),
    SUPABASE_ANON_KEY: String(
      RUNTIME_CONFIG.SUPABASE_PUBLISHABLE_KEY ||
      RUNTIME_CONFIG.SUPABASE_ANON_KEY ||
      ""
    ).trim(),
    SCHEMA_NAME: String(
      RUNTIME_CONFIG.SUPABASE_SCHEMA || "mapa_clientes"
    ).trim(),
    TABLE_NAME: String(
      RUNTIME_CONFIG.SUPABASE_TABLE || "vw_clientes_app"
    ).trim(),
    PAGE_SIZE: Number(RUNTIME_CONFIG.SUPABASE_PAGE_SIZE) || 1000,
    REVERSE_GEOCODING_FUNCTION: String(
      RUNTIME_CONFIG.REVERSE_GEOCODING_FUNCTION || ""
    ).trim(),
    GOOGLE_MAPS_BROWSER_KEY: String(
      RUNTIME_CONFIG.GOOGLE_MAPS_BROWSER_KEY || ""
    ).trim(),
    GOOGLE_MAPS_MAP_ID: String(
      RUNTIME_CONFIG.GOOGLE_MAPS_MAP_ID || ""
    ).trim()
  });

  const APP_VERSION_FALLBACK = "20260902-feira-operacao17";
  const APP_VERSION = getCurrentAppVersion();
  const VERSION_CHECK = Object.freeze({
    URL: "./version.json",
    INTERVAL_MS: 60000,
    INITIAL_DELAY_MS: 12000,
    RELOAD_DELAY_MS: 900
  });

  const BRAZIL_BOUNDS = Object.freeze([
    [-34.2, -74.1],
    [5.4, -32.2]
  ]);

  const VISUAL_SPREAD = Object.freeze({
    MIN_GROUP_SIZE: 2,
    STEP_METERS: 115,
    MAX_RADIUS_METERS: 2300,
    GOLDEN_ANGLE_DEGREES: 137.508
  });

  const MAP_MOTION = Object.freeze({
    BUTTON_ZOOM_STEP: 1,
    WHEEL_PX_PER_ZOOM_LEVEL: 46,
    WHEEL_DEBOUNCE_TIME: 12,
    TOUCH_SETTLE_MS: 110,
    TOUCH_TAP_TOLERANCE: 24,
    TOUCH_INERTIA_DECELERATION: 3000,
    TOUCH_INERTIA_MAX_SPEED: 2400,
    TOUCH_EASE_LINEARITY: 0.23
  });

  // Durante o arraste, a borda do mapa vira uma zona de navegacao continua.
  // A velocidade cresce gradualmente conforme o dedo se aproxima da borda,
  // evitando saltos ao reposicionar pontos em telas touch.
  const DRAG_AUTOPAN = Object.freeze({
    DESKTOP_PADDING_PX: 76,
    TOUCH_PADDING_PX: 112,
    DESKTOP_SPEED: 8,
    TOUCH_SPEED: 11,
    PIN_MIN_SPEED: 2
  });

  const NEW_CLIENT_PIN = Object.freeze({
    TIP_X_RATIO: 0.5,
    TIP_Y_RATIO: 0.93,
    MOVE_TOLERANCE_PX: 10
  });

  const POINT_NAVIGATION = Object.freeze({
    DESKTOP_INDIVIDUAL_ZOOM: 15,
    MOBILE_INDIVIDUAL_ZOOM: 16
  });

  const TERRITORY = Object.freeze({
    MALHAS_URL: "https://servicodados.ibge.gov.br/api/v3/malhas",
    LOCALIDADES_URL: "https://servicodados.ibge.gov.br/api/v1/localidades",
    GEOJSON_FORMAT: "application/vnd.geo+json",
    QUALITY: "intermediaria",
    STATE_MAX_ZOOM: 8,
    CITY_MAX_ZOOM: 13
  });

  const SEARCH_LIMITS = Object.freeze({
    TOTAL: 12,
    STATES: 3,
    CITIES: 4,
    DISTRICTS: 3,
    STREETS: 3,
    CLIENTS: 5
  });

  const HEAT_STYLE = Object.freeze({
    DESKTOP: {
      radius: 28,
      blur: 22,
      minOpacity: 0.22,
      maxZoom: 13
    },
    MOBILE: {
      radius: 21,
      blur: 15,
      minOpacity: 0.24,
      maxZoom: 12
    },
    MOBILE_ANIMATION_MS: 460
  });

  const STORAGE_KEY = "mapa-clientes:v1";

  const BASE_LAYER = Object.freeze({
    OSM: "osm",
    VECTOR: "vector",
    SATELLITE: "satellite"
  });

  // O Esri pode nao ter cache em todos os niveis de zoom. Em telas HiDPI,
  // o detectRetina do Leaflet pede um nivel adicional e expunha o tile cinza
  // "Map data not yet available". Mantemos a navegacao ate z18, escalando
  // com qualidade o ultimo nivel seguro da imagem.
  const SATELLITE_RENDERING = Object.freeze({
    MAX_NATIVE_ZOOM: 17,
    FALLBACK_DELAY_MS: 1300,
    MIN_ERRORS_FOR_FALLBACK: 3
  });

  const BRAZIL_STATE_ALIASES = Object.freeze({
    ac: "AC",
    acre: "AC",
    al: "AL",
    alagoas: "AL",
    ap: "AP",
    amapa: "AP",
    am: "AM",
    amazonas: "AM",
    ba: "BA",
    bahia: "BA",
    ce: "CE",
    ceara: "CE",
    df: "DF",
    "distrito federal": "DF",
    es: "ES",
    "espirito santo": "ES",
    go: "GO",
    goias: "GO",
    ma: "MA",
    maranhao: "MA",
    mt: "MT",
    "mato grosso": "MT",
    ms: "MS",
    "mato grosso do sul": "MS",
    mg: "MG",
    "minas gerais": "MG",
    pa: "PA",
    para: "PA",
    pb: "PB",
    paraiba: "PB",
    pr: "PR",
    parana: "PR",
    pe: "PE",
    pernambuco: "PE",
    pi: "PI",
    piaui: "PI",
    rj: "RJ",
    "rio de janeiro": "RJ",
    rn: "RN",
    "rio grande do norte": "RN",
    rs: "RS",
    "rio grande do sul": "RS",
    ro: "RO",
    rondonia: "RO",
    rr: "RR",
    roraima: "RR",
    sc: "SC",
    "santa catarina": "SC",
    sp: "SP",
    "sao paulo": "SP",
    se: "SE",
    sergipe: "SE",
    to: "TO",
    tocantins: "TO"
  });

  const BRAZIL_STATE_LABELS = Object.freeze({
    AC: "Acre",
    AL: "Alagoas",
    AP: "Amapa",
    AM: "Amazonas",
    BA: "Bahia",
    CE: "Ceara",
    DF: "Distrito Federal",
    ES: "Espirito Santo",
    GO: "Goias",
    MA: "Maranhao",
    MT: "Mato Grosso",
    MS: "Mato Grosso do Sul",
    MG: "Minas Gerais",
    PA: "Para",
    PB: "Paraiba",
    PR: "Parana",
    PE: "Pernambuco",
    PI: "Piaui",
    RJ: "Rio de Janeiro",
    RN: "Rio Grande do Norte",
    RS: "Rio Grande do Sul",
    RO: "Rondonia",
    RR: "Roraima",
    SC: "Santa Catarina",
    SP: "Sao Paulo",
    SE: "Sergipe",
    TO: "Tocantins"
  });

  const IBGE_UF_CODES = Object.freeze({
    AC: "12",
    AL: "27",
    AP: "16",
    AM: "13",
    BA: "29",
    CE: "23",
    DF: "53",
    ES: "32",
    GO: "52",
    MA: "21",
    MT: "51",
    MS: "50",
    MG: "31",
    PA: "15",
    PB: "25",
    PR: "41",
    PE: "26",
    PI: "22",
    RJ: "33",
    RN: "24",
    RS: "43",
    RO: "11",
    RR: "14",
    SC: "42",
    SP: "35",
    SE: "28",
    TO: "17"
  });

  const OPENFREEMAP_ATTRIBUTION =
    '<a href="https://openfreemap.org/" target="_blank" rel="noopener">OpenFreeMap</a> &copy; <a href="https://openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';

  const SATELLITE_ATTRIBUTION =
    '<a href="https://www.esri.com/" target="_blank" rel="noopener">Esri</a> World Imagery, DigitalGlobe, GeoEye, USDA FSA, USGS, AEX, Getmapping, Aerogrid, IGN, IGP, swisstopo, and the GIS User Community';

  const PRECISION_META = Object.freeze({
    CONFIRMADA_CAMPO: {
      title: "Localização confirmada",
      text: "Ponto revisado e confirmado manualmente pela equipe de campo."
    },
    PRECISO_LOGRADOURO: {
      title: "Localização por logradouro",
      text: "Coordenada refinada a partir das informações de endereço disponíveis."
    },
    APROX_CEP_BAIRRO: {
      title: "Localização aproximada",
      text: "Posição estimada usando CEP, bairro/localidade e município."
    },
    APROX_CEP: {
      title: "Localização aproximada por CEP",
      text: "A posição representa a área do CEP e pode não coincidir com o imóvel."
    },
    APROX_SEDE_MUNICIPIO: {
      title: "Localização aproximada",
      text: "Este ponto usa a sede do município como referência. Não representa a posição exata do cliente."
    },
    SEM_STATUS: {
      title: "Precisão não classificada",
      text: "A base não informou o nível de precisão desta coordenada."
    }
  });

  const state = {
    map: null,
    supabaseClient: null,
    clients: [],
    filteredClients: [],
    markerLayer: null,
    heatLayer: null,
    territoryLayer: null,
    areaLayer: null,
    pinPreviewLayer: null,
    pinPreviewRing: null,
    pinPreviewMarker: null,
    relocationPreviewLayer: null,
    relocationPreviewMarker: null,
    relocationPreviewSourceMarker: null,
    heatPoints: [],
    selectedLayer: null,
    baseLayers: {},
    activeBaseLayer: null,
    markerById: new Map(),
    coordinateCounts: new Map(),
    selectedClient: null,
    searchQuery: "",
    searchFocusClientId: "",
    searchIntentOverride: null,
    searchSuggestions: [],
    searchResultIndex: -1,
    lastSearchFitKey: "",
    viewMode: "markers",
    baseMode: BASE_LAYER.OSM,
    reportOpen: false,
    reportTab: "overview",
    maintenanceOpen: false,
    session: null,
    operator: null,
    authSubscription: null,
    maintenanceActivity: [],
    maintenanceView: "home",
    clientFormMode: "new",
    editingClientId: "",
    locationDraft: null,
    addressAutofill: {},
    locationPickerActive: false,
    googleGeocoderPromise: null,
    newClientPinDrag: null,
    pendingRelocation: null,
    areaSelection: null,
    filters: {
      uf: "",
      municipio: "",
      situacao: ""
    },
    toastTimer: null,
    searchTimer: null,
    regionTimer: null,
    mapMotionTimer: null,
    regionTargetLatLng: null,
    regionTargetSource: "center",
    municipalityCatalog: null,
    territoryCache: new Map(),
    activeTerritoryKey: "",
    territoryRequestKey: "",
    updateCheckTimer: null,
    updateReloading: false,
    heatAnimationFrame: null,
    heatAnimationClassTimer: null,
    satelliteNoticeShown: false,
    satelliteErrorShown: false,
    satelliteHealthCycle: 0,
    satelliteLoadedTiles: 0,
    satelliteFailedTiles: 0,
    satelliteFallbackTimer: null,
    loading: false
  };

  const dom = {};

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    cacheDom();
    restoreUiState();
    initMap();
    bindEvents();
    syncViewButtons();
    syncBaseButtons();
    startUpdateChecks();

    if (!state.map) return;
    await connectAndLoad();
  }

  function cacheDom() {
    const ids = [
      "app",
      "map",
      "field-marker-legend",
      "new-client-pin",
      "search-input",
      "clear-search",
      "search-results",
      "filter-uf",
      "filter-municipio",
      "filter-situacao",
      "reset-filters",
      "maintenance-access",
      "maintenance-label",
      "open-report",
      "result-count",
      "result-pill",
      "data-caption",
      "view-markers",
      "view-heat",
      "base-osm",
      "base-vector",
      "base-satellite",
      "zoom-in",
      "zoom-out",
      "fit-brazil",
      "region-readout",
      "region-level",
      "region-title",
      "region-subtitle",
      "modal-backdrop",
      "maintenance-panel",
      "close-maintenance",
      "maintenance-title",
      "maintenance-subtitle",
      "maintenance-login-view",
      "maintenance-login-form",
      "maintenance-email",
      "maintenance-password",
      "maintenance-login-error",
      "maintenance-login-submit",
      "maintenance-session-view",
      "maintenance-profile-initials",
      "maintenance-profile-name",
      "maintenance-profile-role",
      "maintenance-new-client",
      "maintenance-sign-out",
      "maintenance-activity-count",
      "maintenance-activity-list",
      "maintenance-client-view",
      "maintenance-client-form",
      "maintenance-client-back",
      "maintenance-client-form-title",
      "maintenance-client-form-note",
      "maintenance-client-fields",
      "maintenance-client-name",
      "maintenance-client-legal-name",
      "maintenance-client-cnpj",
      "maintenance-client-contact",
      "maintenance-client-phone",
      "maintenance-client-whatsapp",
      "maintenance-client-email",
      "maintenance-client-uf",
      "maintenance-client-city",
      "maintenance-client-district",
      "maintenance-client-cep",
      "maintenance-client-street",
      "maintenance-client-notes",
      "maintenance-location-card",
      "maintenance-location-title",
      "maintenance-location-coordinates",
      "maintenance-location-address",
      "maintenance-location-attribution",
      "maintenance-location-privacy",
      "maintenance-refresh-address",
      "maintenance-pick-location",
      "maintenance-client-error",
      "maintenance-client-submit",
      "location-picker-bar",
      "use-device-location",
      "cancel-location-picker",
      "relocation-confirmation",
      "relocation-client-name",
      "relocation-coordinates",
      "relocation-location-summary",
      "relocation-cancel",
      "relocation-confirm",
      "client-panel",
      "sheet-handle",
      "close-panel",
      "client-status",
      "client-title",
      "client-subtitle",
      "client-preview",
      "client-avatar",
      "preview-label",
      "preview-title",
      "preview-meta",
      "client-commercial-card",
      "client-score-value",
      "client-score-label",
      "client-score-title",
      "client-score-text",
      "client-signal-list",
      "client-quick-actions",
      "client-maintenance-actions",
      "edit-client",
      "relocate-client",
      "route-client",
      "copy-address-client",
      "copy-maps-client",
      "coordinate-preview",
      "coordinate-preview-title",
      "coordinate-preview-count",
      "coordinate-preview-list",
      "precision-card",
      "precision-title",
      "precision-text",
      "detail-cnpj",
      "detail-address",
      "detail-phone",
      "detail-cnae",
      "detail-same-coordinate",
      "nearby-clients",
      "nearby-title",
      "nearby-count",
      "nearby-client-list",
      "route-client-bottom",
      "call-client",
      "open-maps-client",
      "copy-client",
      "report-panel",
      "close-report",
      "report-context",
      "report-scope-label",
      "report-scope-note",
      "report-select-visible-area",
      "report-fit-area",
      "report-clear-area",
      "report-export-filtered",
      "report-export-area",
      "report-export-hotspots",
      "report-tabs",
      "report-total-value",
      "report-total-note",
      "report-coverage-value",
      "report-coverage-note",
      "report-active-value",
      "report-active-note",
      "report-unmapped-value",
      "report-unmapped-note",
      "report-cities-value",
      "report-cities-note",
      "report-states-value",
      "report-states-note",
      "report-top-city-value",
      "report-top-city-note",
      "report-shared-value",
      "report-shared-note",
      "report-empty",
      "report-top-caption",
      "chart-top-cities",
      "chart-status",
      "chart-uf",
      "chart-coordinate-groups",
      "report-density-list",
      "report-section-overview",
      "report-section-territory",
      "report-section-quality",
      "report-district-caption",
      "chart-top-districts",
      "chart-top-streets",
      "report-ranking-table",
      "report-coverage-table",
      "report-insights",
      "chart-geocode-quality",
      "report-quality-table",
      "chart-cnae",
      "app-status",
      "status-spinner",
      "status-title",
      "status-message",
      "status-action",
      "toast"
    ];

    for (const id of ids) {
      const element = document.getElementById(id);
      if (!element) {
        throw new Error(`Elemento obrigatório não encontrado: #${id}`);
      }
      dom[toCamelCase(id)] = element;
    }
  }

  function initMap() {
    if (!window.L) {
      showFatalStatus(
        "Mapa indisponível",
        "A biblioteca Leaflet não foi carregada. Verifique sua conexão com a internet."
      );
      return;
    }

    const bounds = L.latLngBounds(BRAZIL_BOUNDS);
    const mobileViewport = isMobileViewport();

    state.map = L.map("map", {
      zoomControl: false,
      attributionControl: true,
      minZoom: 3,
      maxZoom: 18,
      zoomSnap: mobileViewport ? 1 : 0.5,
      zoomDelta: MAP_MOTION.BUTTON_ZOOM_STEP,
      wheelPxPerZoomLevel: MAP_MOTION.WHEEL_PX_PER_ZOOM_LEVEL,
      wheelDebounceTime: MAP_MOTION.WHEEL_DEBOUNCE_TIME,
      bounceAtZoomLimits: false,
      // A transicao de opacidade de cada tile e bonita em desktop, mas custa
      // frames em touch quando ha uma imagem de satelite em movimento.
      fadeAnimation: !mobileViewport,
      markerZoomAnimation: !mobileViewport,
      zoomAnimationThreshold: 3,
      tapTolerance: mobileViewport ? MAP_MOTION.TOUCH_TAP_TOLERANCE : 15,
      inertia: true,
      inertiaDeceleration: mobileViewport ? MAP_MOTION.TOUCH_INERTIA_DECELERATION : 2600,
      inertiaMaxSpeed: mobileViewport ? MAP_MOTION.TOUCH_INERTIA_MAX_SPEED : 1700,
      easeLinearity: mobileViewport ? MAP_MOTION.TOUCH_EASE_LINEARITY : 0.18,
      worldCopyJump: true,
      preferCanvas: true
    });

    initBaseLayers();
    setBaseLayer(state.baseMode, { persist: false, notify: false });

    state.map.fitBounds(bounds, {
      padding: [18, 18],
      animate: false
    });

    const clusterOptions = {
      chunkedLoading: true,
      chunkInterval: 120,
      chunkDelay: 30,
      removeOutsideVisibleBounds: true,
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      zoomToBoundsOnClick: false,
      disableClusteringAtZoom: mobileViewport ? 16 : 15,
      animate: false,
      animateAddingMarkers: false,
      spiderfyDistanceMultiplier: mobileViewport ? 1.55 : 1.35,
      maxClusterRadius(zoom) {
        if (mobileViewport) {
          if (zoom <= 6) return 96;
          if (zoom <= 10) return 76;
          if (zoom <= 13) return 58;
          return 42;
        }

        if (zoom <= 6) return 82;
        if (zoom <= 9) return 62;
        return 48;
      },
      iconCreateFunction(cluster) {
        const count = cluster.getChildCount();
        const sizeClass =
          count >= 100 ? "cluster-large" : count >= 20 ? "cluster-medium" : "cluster-small";
        const size = mobileViewport
          ? count >= 100 ? 46 : count >= 20 ? 40 : 36
          : count >= 100 ? 52 : count >= 20 ? 46 : 40;

        return L.divIcon({
          html: `<div class="cluster-bubble ${sizeClass}">${formatNumber(count)}</div>`,
          className: "marker-cluster",
          iconSize: [size, size]
        });
      }
    };

    state.markerLayer =
      typeof L.markerClusterGroup === "function"
        ? L.markerClusterGroup(clusterOptions)
        : L.layerGroup();

    if (typeof state.markerLayer.on === "function") {
      state.markerLayer.on("clusterclick", handleClusterClick);
    }

    const heatAvailable = typeof L.heatLayer === "function";

    state.heatLayer = heatAvailable
      ? L.heatLayer([], getHeatOptions())
      : L.layerGroup();

    if (!heatAvailable) {
      dom.viewHeat.disabled = true;
      dom.viewHeat.title = "Visualização de calor indisponível";
      if (state.viewMode === "heat") state.viewMode = "markers";
      syncViewButtons();
    }

    state.selectedLayer = L.layerGroup().addTo(state.map);
    state.pinPreviewLayer = L.layerGroup().addTo(state.map);
    state.relocationPreviewLayer = L.layerGroup().addTo(state.map);
    state.territoryLayer = L.geoJSON(null, {
      interactive: false,
      style: getTerritoryStyle
    }).addTo(state.map);
    state.areaLayer = L.layerGroup().addTo(state.map);

    state.map.on("click", (event) => {
      if (handleLocationPickerClick(event)) return;
      setRegionTarget(event.latlng, getClickRegionSource());
      hideSearchResults();
      updateRegionReadout();
    });

    state.map.on("mousemove", handleRegionPointerMove);
    state.map.on("movestart zoomstart", handleMapMotionStart);
    state.map.on("move zoom", scheduleRegionReadoutUpdate);
    state.map.on("moveend zoomend", handleMapMotionEnd);
    updateRegionReadout();

    applyViewMode({ persist: false });
  }

  function bindNewClientPin() {
    const pin = dom.newClientPin;
    if (!pin) return;

    pin.addEventListener("pointerdown", (event) => {
      if (event.button > 0 || state.locationPickerActive || state.pendingRelocation) {
        return;
      }

      if (!canManageClients()) {
        openMaintenancePanel();
        showToast("Entre com um operador para cadastrar pelo pino.");
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      const pinBounds = pin.getBoundingClientRect();
      state.newClientPinDrag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        tipX: pinBounds.left + pinBounds.width * NEW_CLIENT_PIN.TIP_X_RATIO,
        tipY: pinBounds.top + pinBounds.height * NEW_CLIENT_PIN.TIP_Y_RATIO,
        moved: false,
        pointerX: event.clientX,
        pointerY: event.clientY,
        autoPanFrame: 0
      };
      pin.classList.add("is-dragging");
      dom.app.classList.add("is-placing-new-client");
      pin.setPointerCapture?.(event.pointerId);
    });

    pin.addEventListener("pointermove", (event) => {
      const drag = state.newClientPinDrag;
      if (!drag || event.pointerId !== drag.pointerId) return;

      drag.pointerX = event.clientX;
      drag.pointerY = event.clientY;
      const offsetX = event.clientX - drag.tipX;
      const offsetY = event.clientY - drag.tipY;
      drag.moved = drag.moved || Math.hypot(
        event.clientX - drag.startX,
        event.clientY - drag.startY
      ) > NEW_CLIENT_PIN.MOVE_TOLERANCE_PX;
      pin.style.setProperty("--pin-drag-x", `${offsetX}px`);
      pin.style.setProperty("--pin-drag-y", `${offsetY}px`);

      updateNewClientPinPreviewFromDrag(drag);
      startNewClientPinAutoPan(pin, drag);
    });

    const finishPinDrag = (event, cancelled = false) => {
      const drag = state.newClientPinDrag;
      if (!drag || event.pointerId !== drag.pointerId) return;

      stopNewClientPinAutoPan(drag);
      state.newClientPinDrag = null;
      pin.classList.remove("is-dragging");
      dom.app.classList.remove("is-placing-new-client");
      pin.style.removeProperty("--pin-drag-x");
      pin.style.removeProperty("--pin-drag-y");
      clearNewClientPinPreview();
      if (pin.hasPointerCapture?.(event.pointerId)) {
        pin.releasePointerCapture(event.pointerId);
      }

      if (cancelled || !drag.moved) {
        if (!cancelled) showToast("Arraste o 📍 ate o local exato do novo cliente.");
        return;
      }

      const latlng = getMapLatLngFromPointer(event.clientX, event.clientY);
      if (!latlng || !isPointInBrazil(latlng.lat, latlng.lng)) {
        showToast("Solte o 📍 dentro do mapa do Brasil.");
        return;
      }

      beginNewClientFlowAtPoint(latlng, "ATALHO_PIN_ARRASTADO");
    };

    pin.addEventListener("pointerup", (event) => finishPinDrag(event));
    pin.addEventListener("pointercancel", (event) => finishPinDrag(event, true));
  }

  function getMapLatLngFromPointer(clientX, clientY) {
    const container = state.map?.getContainer();
    if (!container || !state.map) return null;

    const bounds = container.getBoundingClientRect();
    return state.map.containerPointToLatLng([
      clientX - bounds.left,
      clientY - bounds.top
    ]);
  }

  function renderNewClientPinPreview(latlng) {
    if (!state.pinPreviewLayer || !window.L) return;

    if (!state.pinPreviewRing) {
      state.pinPreviewRing = L.circleMarker(latlng, {
        radius: 15,
        weight: 2,
        color: "rgba(255, 255, 255, 0.96)",
        fillColor: "rgba(0, 122, 255, 0.16)",
        fillOpacity: 0.9,
        interactive: false
      }).addTo(state.pinPreviewLayer);
      state.pinPreviewMarker = L.circleMarker(latlng, {
        radius: 5.5,
        weight: 2.5,
        color: "#ffffff",
        fillColor: "#007aff",
        fillOpacity: 1,
        interactive: false
      }).addTo(state.pinPreviewLayer);
      return;
    }

    state.pinPreviewRing.setLatLng(latlng);
    state.pinPreviewMarker?.setLatLng(latlng);
  }

  function clearNewClientPinPreview() {
    state.pinPreviewLayer?.clearLayers();
    state.pinPreviewRing = null;
    state.pinPreviewMarker = null;
  }

  function updateNewClientPinPreviewFromDrag(drag) {
    const latlng = getMapLatLngFromPointer(drag?.pointerX, drag?.pointerY);
    if (latlng && isPointInBrazil(latlng.lat, latlng.lng)) {
      renderNewClientPinPreview(latlng);
      return;
    }

    clearNewClientPinPreview();
  }

  function startNewClientPinAutoPan(pin, drag) {
    if (!drag || drag.autoPanFrame) return;

    const panStep = () => {
      drag.autoPanFrame = 0;
      if (state.newClientPinDrag !== drag) return;

      const movement = getDragAutoPanMovement(drag.pointerX, drag.pointerY);
      if (!movement) {
        dom.app.classList.remove("is-autopanning-map");
        return;
      }

      dom.app.classList.add("is-autopanning-map");
      handleMapMotionStart();
      state.map?.panBy(movement, { animate: false, noMoveStart: true });
      updateNewClientPinPreviewFromDrag(drag);
      drag.autoPanFrame = window.requestAnimationFrame(panStep);
    };

    drag.autoPanFrame = window.requestAnimationFrame(panStep);
  }

  function stopNewClientPinAutoPan(drag = state.newClientPinDrag) {
    if (drag?.autoPanFrame) {
      window.cancelAnimationFrame(drag.autoPanFrame);
      drag.autoPanFrame = 0;
    }
    dom.app.classList.remove("is-autopanning-map");
    handleMapMotionEnd();
  }

  function getDragAutoPanMovement(clientX, clientY) {
    const container = state.map?.getContainer();
    if (!container || !Number.isFinite(clientX) || !Number.isFinite(clientY)) return null;

    const bounds = container.getBoundingClientRect();
    const settings = getDragAutoPanSettings();
    const x = getAutoPanAxisMovement(clientX - bounds.left, bounds.width, settings);
    const y = getAutoPanAxisMovement(clientY - bounds.top, bounds.height, settings);

    return x || y ? [x, y] : null;
  }

  function getAutoPanAxisMovement(position, length, settings) {
    if (!Number.isFinite(position) || !Number.isFinite(length) || length <= 0) return 0;

    const padding = Math.min(settings.padding, Math.max(24, length / 3));
    let direction = 0;
    let intensity = 0;

    if (position < padding) {
      direction = -1;
      intensity = (padding - position) / padding;
    } else if (position > length - padding) {
      direction = 1;
      intensity = (position - (length - padding)) / padding;
    }

    if (!direction) return 0;
    const easedIntensity = Math.min(1, Math.max(0, intensity)) ** 1.55;
    const speed = DRAG_AUTOPAN.PIN_MIN_SPEED +
      (settings.speed - DRAG_AUTOPAN.PIN_MIN_SPEED) * easedIntensity;
    return direction * Math.round(speed);
  }

  function getDragAutoPanSettings() {
    const touchInput = isTouchInteraction();
    return touchInput
      ? { padding: DRAG_AUTOPAN.TOUCH_PADDING_PX, speed: DRAG_AUTOPAN.TOUCH_SPEED }
      : { padding: DRAG_AUTOPAN.DESKTOP_PADDING_PX, speed: DRAG_AUTOPAN.DESKTOP_SPEED };
  }

  function getMarkerAutoPanOptions() {
    const settings = getDragAutoPanSettings();
    return {
      autoPan: true,
      autoPanPadding: [settings.padding, settings.padding],
      autoPanSpeed: settings.speed
    };
  }

  function initBaseLayers() {
    const mobileViewport = isMobileViewport();
    const tileOptions = {
      noWrap: false,
      // Mantem um pequeno buffer visual durante o pan. Em touch, os novos
      // tiles so sao decodificados depois do gesto para priorizar o dedo.
      keepBuffer: mobileViewport ? 3 : 2,
      updateWhenIdle: mobileViewport,
      // Durante zoom usamos a imagem atual escalonada e trocamos os tiles ao
      // final. Em touch, novos tiles so sao decodificados apos o gesto.
      updateWhenZooming: false,
      updateInterval: mobileViewport ? 120 : 60
    };

    const standardRasterTileOptions = {
      ...tileOptions,
      detectRetina: true
    };

    state.baseLayers = {
      [BASE_LAYER.OSM]: L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
        maxZoom: 19,
        maxNativeZoom: 19,
        ...standardRasterTileOptions
      }),
    };

    const satelliteTileOptions = {
      ...tileOptions,
      // Nao solicitar o z+1 em televisores e monitores de alta densidade.
      detectRetina: false,
      maxZoom: 18,
      maxNativeZoom: SATELLITE_RENDERING.MAX_NATIVE_ZOOM
    };

    const satelliteImagery = L.tileLayer(
      "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        attribution: SATELLITE_ATTRIBUTION,
        ...satelliteTileOptions
      }
    );

    const satelliteLabels = L.tileLayer(
      "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
      {
        opacity: mobileViewport ? 0.9 : 0.78,
        ...satelliteTileOptions,
        // Rotulos sao auxiliares. Eles carregam apos a navegacao para deixar
        // a imagem principal responsiva e somem no zoom de precisao.
        maxZoom: 15,
        maxNativeZoom: 15,
        keepBuffer: mobileViewport ? 1 : 1,
        updateWhenIdle: true,
        updateInterval: mobileViewport ? 180 : 140
      }
    );

    state.baseLayers[BASE_LAYER.SATELLITE] = L.layerGroup([
      satelliteImagery,
      satelliteLabels
    ]);

    satelliteImagery.on("tileload", noteSatelliteTileLoaded);
    satelliteImagery.on("tileerror", handleSatelliteTileError);

    if (typeof L.maplibreGL === "function" && window.maplibregl) {
      state.baseLayers[BASE_LAYER.VECTOR] = L.maplibreGL({
        style: "https://tiles.openfreemap.org/styles/liberty",
        attribution: OPENFREEMAP_ATTRIBUTION,
        pane: "tilePane",
        interactive: false
      });
    } else {
      state.baseMode = BASE_LAYER.OSM;
    }

    syncBaseButtons();
  }

  function resetSatelliteHealth() {
    window.clearTimeout(state.satelliteFallbackTimer);
    state.satelliteFallbackTimer = null;
    state.satelliteHealthCycle += 1;
    state.satelliteLoadedTiles = 0;
    state.satelliteFailedTiles = 0;
    state.satelliteErrorShown = false;
  }

  function stopSatelliteHealth() {
    window.clearTimeout(state.satelliteFallbackTimer);
    state.satelliteFallbackTimer = null;
  }

  function noteSatelliteTileLoaded() {
    if (state.baseMode !== BASE_LAYER.SATELLITE) return;
    state.satelliteLoadedTiles += 1;
  }

  function handleSatelliteTileError() {
    if (state.baseMode !== BASE_LAYER.SATELLITE) return;

    state.satelliteFailedTiles += 1;
    if (
      state.satelliteFallbackTimer ||
      state.satelliteFailedTiles < SATELLITE_RENDERING.MIN_ERRORS_FOR_FALLBACK
    ) {
      return;
    }

    const healthCycle = state.satelliteHealthCycle;
    state.satelliteFallbackTimer = window.setTimeout(() => {
      state.satelliteFallbackTimer = null;
      const shouldFallback =
        state.baseMode === BASE_LAYER.SATELLITE &&
        state.satelliteHealthCycle === healthCycle &&
        state.satelliteFailedTiles >= SATELLITE_RENDERING.MIN_ERRORS_FOR_FALLBACK &&
        state.satelliteFailedTiles > state.satelliteLoadedTiles;

      if (!shouldFallback) return;

      state.satelliteErrorShown = true;
      const fallbackMode = state.baseLayers[BASE_LAYER.VECTOR]
        ? BASE_LAYER.VECTOR
        : BASE_LAYER.OSM;
      setBaseLayer(fallbackMode, { persist: true, notify: false });
      showToast("Imagem de satelite indisponivel. Voltamos para uma camada estavel.");
    }, SATELLITE_RENDERING.FALLBACK_DELAY_MS);
  }

  function bindEvents() {
    bindNewClientPin();
    dom.searchInput.addEventListener("input", handleSearchInput);
    dom.searchInput.addEventListener("focus", () => {
      if (state.searchQuery) renderSearchResults();
    });
    dom.searchInput.addEventListener("keydown", handleSearchKeyboard);

    dom.clearSearch.addEventListener("click", () => {
      dom.searchInput.value = "";
      state.searchQuery = "";
      state.searchFocusClientId = "";
      state.searchIntentOverride = null;
      state.searchSuggestions = [];
      state.searchResultIndex = -1;
      state.lastSearchFitKey = "";
      dom.clearSearch.classList.add("is-hidden");
      hideSearchResults();
      applyFilters({ fit: false });
      dom.searchInput.focus();
    });

    dom.filterUf.addEventListener("change", () => {
      state.filters.uf = dom.filterUf.value;
      refreshMunicipioOptions();
      state.filters.municipio = dom.filterMunicipio.value;
      persistUiState();
      applyFilters({ fit: true });
    });

    dom.filterMunicipio.addEventListener("change", () => {
      state.filters.municipio = dom.filterMunicipio.value;
      persistUiState();
      applyFilters({ fit: true });
    });

    dom.filterSituacao.addEventListener("change", () => {
      state.filters.situacao = dom.filterSituacao.value;
      persistUiState();
      applyFilters({ fit: true });
    });

    dom.resetFilters.addEventListener("click", resetFilters);
    dom.maintenanceAccess.addEventListener("click", openMaintenancePanel);
    dom.closeMaintenance.addEventListener("click", closeMaintenancePanel);
    dom.maintenanceLoginForm.addEventListener("submit", handleMaintenanceLogin);
    dom.maintenanceSignOut.addEventListener("click", handleMaintenanceSignOut);
    dom.maintenanceNewClient.addEventListener("click", beginNewClientFlow);
    dom.maintenanceClientBack.addEventListener("click", showMaintenanceHome);
    dom.maintenanceClientForm.addEventListener("submit", handleClientFormSubmit);
    dom.maintenancePickLocation.addEventListener("click", startLocationPicker);
    dom.maintenanceRefreshAddress.addEventListener("click", retryLocationAddress);
    dom.useDeviceLocation.addEventListener("click", useDeviceLocation);
    dom.cancelLocationPicker.addEventListener("click", cancelLocationPicker);
    dom.relocationCancel.addEventListener("click", cancelPendingRelocation);
    dom.relocationConfirm.addEventListener("click", confirmPendingRelocation);
    dom.editClient.addEventListener("click", () => openClientForm("edit", state.selectedClient));
    dom.relocateClient.addEventListener("click", () => openClientForm("location", state.selectedClient));

    dom.viewMarkers.addEventListener("click", () => setViewMode("markers"));
    dom.viewHeat.addEventListener("click", () => setViewMode("heat"));
    dom.baseOsm.addEventListener("click", () => setBaseLayer(BASE_LAYER.OSM));
    dom.baseVector.addEventListener("click", () => setBaseLayer(BASE_LAYER.VECTOR));
    dom.baseSatellite.addEventListener("click", () => setBaseLayer(BASE_LAYER.SATELLITE));

    dom.zoomIn.addEventListener("click", () => stepZoom(1));
    dom.zoomOut.addEventListener("click", () => stepZoom(-1));
    dom.fitBrazil.addEventListener("click", fitBrazil);

    dom.closePanel.addEventListener("click", closeClientPanel);
    dom.sheetHandle.addEventListener("click", toggleMobileSheet);
    dom.copyClient.addEventListener("click", copySelectedClient);
    dom.copyAddressClient.addEventListener("click", copySelectedClientAddress);
    dom.copyMapsClient.addEventListener("click", copySelectedClientMaps);
    dom.openReport.addEventListener("click", openReportPanel);
    dom.closeReport.addEventListener("click", closeReportPanel);
    dom.reportSelectVisibleArea.addEventListener("click", selectVisibleMapArea);
    dom.reportFitArea.addEventListener("click", fitAreaSelection);
    dom.reportClearArea.addEventListener("click", () => clearAreaSelection({ apply: true }));
    dom.reportExportFiltered.addEventListener("click", exportFilteredClients);
    dom.reportExportArea.addEventListener("click", exportAreaClients);
    dom.reportExportHotspots.addEventListener("click", exportHotspots);
    dom.reportTabs.addEventListener("click", handleReportTabClick);
    dom.modalBackdrop.addEventListener("click", closeTopModal);

    dom.statusAction.addEventListener("click", connectAndLoad);

    document.addEventListener("pointerdown", (event) => {
      const searchWrap = dom.searchInput.closest(".search-wrap");
      if (searchWrap && !searchWrap.contains(event.target)) {
        hideSearchResults();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        if (state.locationPickerActive) {
          cancelLocationPicker();
          return;
        }
        state.map?.closePopup();
        closeTopModal();
      }
    });

    window.addEventListener(
      "resize",
      debounce(() => {
        state.map?.invalidateSize({ pan: false });
        if (state.viewMode === "heat") {
          refreshHeatLayer({ animate: false });
        }
      }, 120)
    );
  }

  function stepZoom(direction) {
    if (!state.map) return;

    const snap = state.map.options.zoomSnap || 1;
    const rawTarget = state.map.getZoom() + direction * MAP_MOTION.BUTTON_ZOOM_STEP;
    const snappedTarget = Math.round(rawTarget / snap) * snap;
    const targetZoom = clamp(
      snappedTarget,
      state.map.getMinZoom(),
      state.map.getMaxZoom()
    );

    if (targetZoom === state.map.getZoom()) return;

    state.map.stop();
    state.map.setZoom(targetZoom, {
      animate: !prefersReducedMotion()
    });
  }

  function openReportPanel() {
    state.reportOpen = true;
    dom.reportPanel.classList.add("is-open");
    dom.reportPanel.setAttribute("aria-hidden", "false");
    dom.openReport.setAttribute("aria-expanded", "true");
    syncModalBackdrop();
    syncReportTabs();
    syncAreaSelectionUi();
    renderReport();
  }

  function closeReportPanel() {
    state.reportOpen = false;
    dom.reportPanel.classList.remove("is-open");
    dom.reportPanel.setAttribute("aria-hidden", "true");
    dom.openReport.setAttribute("aria-expanded", "false");
    syncModalBackdrop();
  }

  function closeTopModal() {
    if (state.pendingRelocation) {
      cancelPendingRelocation();
      return;
    }

    if (state.maintenanceOpen) {
      closeMaintenancePanel();
      return;
    }

    if (state.reportOpen) {
      closeReportPanel();
      return;
    }

    if (state.selectedClient) {
      closeClientPanel();
    }
  }

  function syncModalBackdrop() {
    const hasActiveModal =
      state.maintenanceOpen ||
      state.reportOpen ||
      dom.clientPanel.classList.contains("is-open");

    dom.app.classList.toggle("has-mobile-modal", hasActiveModal);
    dom.modalBackdrop.classList.toggle("is-visible", hasActiveModal);
  }

  function openMaintenancePanel(options = {}) {
    const preserveView = options?.preserve === true;
    if (!preserveView) {
      state.maintenanceView = state.operator ? "home" : "login";
    }
    state.maintenanceOpen = true;
    dom.maintenancePanel.classList.add("is-open");
    dom.maintenancePanel.setAttribute("aria-hidden", "false");
    dom.maintenanceAccess.setAttribute("aria-expanded", "true");
    renderMaintenanceSession();
    syncModalBackdrop();

    window.setTimeout(() => {
      if (state.operator && state.maintenanceView === "client") {
        const focusTarget =
          state.clientFormMode === "location"
            ? dom.maintenancePickLocation
            : dom.maintenanceClientName;
        focusTarget.focus();
      } else if (state.operator) {
        dom.maintenanceNewClient.focus();
      } else {
        dom.maintenanceEmail.focus();
      }
    }, 80);
  }

  function closeMaintenancePanel() {
    state.maintenanceOpen = false;
    dom.maintenancePanel.classList.remove("is-open");
    dom.maintenancePanel.setAttribute("aria-hidden", "true");
    dom.maintenanceAccess.setAttribute("aria-expanded", "false");
    setMaintenanceError("");
    syncModalBackdrop();
  }

  async function handleMaintenanceLogin(event) {
    event.preventDefault();
    if (!state.supabaseClient) {
      setMaintenanceError("A conexao com o Supabase ainda nao esta pronta.");
      return;
    }

    const email = cleanValue(dom.maintenanceEmail.value).toLowerCase();
    const password = String(dom.maintenancePassword.value || "");
    if (!email || !password) {
      setMaintenanceError("Informe e-mail e senha.");
      return;
    }

    setMaintenanceBusy(true);
    setMaintenanceError("");

    try {
      const { data, error } = await state.supabaseClient.auth.signInWithPassword({
        email,
        password
      });
      if (error) throw error;

      await syncAuthSession(data.session);
      if (!state.operator) {
        await state.supabaseClient.auth.signOut();
        throw new Error("Usuario autenticado, mas sem perfil ativo de operador.");
      }

      dom.maintenancePassword.value = "";
      showToast(`Sessao iniciada como ${state.operator.nome}.`);
    } catch (error) {
      console.error("[Mapa de clientes] Falha no login:", error);
      setMaintenanceError(friendlyAuthError(error));
    } finally {
      setMaintenanceBusy(false);
    }
  }

  async function handleMaintenanceSignOut() {
    if (!state.supabaseClient) return;

    setMaintenanceBusy(true);
    try {
      const { error } = await state.supabaseClient.auth.signOut();
      if (error) throw error;
      state.session = null;
      state.operator = null;
      state.maintenanceActivity = [];
      renderMaintenanceSession();
      showToast("Sessao de manutencao encerrada.");
    } catch (error) {
      setMaintenanceError(friendlyAuthError(error));
    } finally {
      setMaintenanceBusy(false);
    }
  }

  function startAuthListener() {
    if (!state.supabaseClient || state.authSubscription) return;

    const { data } = state.supabaseClient.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(() => {
        syncAuthSession(session).catch((error) => {
          console.warn("[Mapa de clientes] Falha ao atualizar sessao:", error);
        });
      }, 0);
    });
    state.authSubscription = data?.subscription || null;
  }

  async function syncAuthSession(providedSession) {
    if (!state.supabaseClient) return;

    let session = providedSession;
    if (session === undefined) {
      const { data, error } = await state.supabaseClient.auth.getSession();
      if (error) throw error;
      session = data?.session || null;
    }

    state.session = session || null;
    state.operator = null;
    state.maintenanceActivity = [];

    if (state.session?.user?.id) {
      const { data, error } = await state.supabaseClient
        .schema(CONFIG.SCHEMA_NAME)
        .from("operadores")
        .select("usuario_id, nome, papel, ativo")
        .eq("usuario_id", state.session.user.id)
        .eq("ativo", true)
        .maybeSingle();

      if (error) {
        console.error("[Mapa de clientes] Falha ao validar operador:", error);
      } else if (data) {
        state.operator = data;
        await loadMaintenanceActivity();
      }
    }

    renderMaintenanceSession();
  }

  function renderMaintenanceSession() {
    if (!dom.maintenanceLoginView) return;

    const authenticated = Boolean(state.session && state.operator);
    const clientView = authenticated && state.maintenanceView === "client";
    dom.maintenanceLoginView.classList.toggle("is-hidden", authenticated);
    dom.maintenanceSessionView.classList.toggle("is-hidden", !authenticated || clientView);
    dom.maintenanceClientView.classList.toggle("is-hidden", !clientView);
    dom.maintenanceAccess.classList.toggle("is-authenticated", authenticated);
    if (!authenticated) dom.clientMaintenanceActions.classList.add("is-hidden");
    dom.fieldMarkerLegend.classList.toggle("is-hidden", !authenticated);
    syncMarkerDragState();

    if (!authenticated) {
      dom.maintenanceLabel.textContent = "Manutencao";
      dom.maintenanceTitle.textContent = "Manutencao";
      dom.maintenanceSubtitle.textContent = state.session
        ? "Este usuario ainda nao possui um perfil de operador ativo."
        : "Entre com o usuario autorizado no Supabase.";
      return;
    }

    const operatorName = cleanValue(state.operator.nome) || "Operador";
    const role = cleanValue(state.operator.papel) || "OPERADOR";
    const canEdit = ["ADMIN", "MANUTENCAO", "EDITOR"].includes(role);
    dom.maintenanceLabel.textContent = operatorName.split(/\s+/)[0];
    dom.maintenanceTitle.textContent = "Area de manutencao";
    dom.maintenanceSubtitle.textContent = "Cadastros e alteracoes ficam registrados no historico.";
    dom.maintenanceProfileName.textContent = operatorName;
    dom.maintenanceProfileRole.textContent = `Perfil ${role}`;
    dom.maintenanceProfileInitials.textContent = getInitialsFromText(operatorName);
    dom.maintenanceNewClient.disabled = !canEdit;
    dom.clientMaintenanceActions.classList.toggle(
      "is-hidden",
      !state.selectedClient || !canEdit
    );
    renderMaintenanceActivity();
  }

  function showMaintenanceHome() {
    state.maintenanceView = "home";
    state.editingClientId = "";
    state.locationDraft = null;
    state.addressAutofill = {};
    state.selectedLayer?.clearLayers();
    setClientFormError("");
    renderMaintenanceSession();
  }

  function canManageClients() {
    return Boolean(
      state.operator &&
      ["ADMIN", "MANUTENCAO", "EDITOR"].includes(state.operator.papel)
    );
  }

  function beginNewClientFlow() {
    if (!canManageClients()) {
      showToast("Este perfil nao possui permissao de edicao.");
      return;
    }

    prepareNewClientForm();
    startLocationPicker();
  }

  function beginNewClientFlowAtPoint(
    latlng,
    source = "ATALHO_PIN_ARRASTADO"
  ) {
    if (!canManageClients()) return;

    prepareNewClientForm();
    void confirmLocationDraft(latlng, {
      source
    });
    showToast("Ponto marcado. Confira o endereco e complete o cadastro.");
  }

  function prepareNewClientForm() {
    state.clientFormMode = "new";
    state.editingClientId = "";
    state.locationDraft = null;
    state.addressAutofill = {};
    state.maintenanceView = "client";
    setClientFormError("");
    populateClientForm(null);
  }

  function openClientForm(mode, client = null) {
    if (!canManageClients()) {
      showToast("Este perfil nao possui permissao de edicao.");
      return;
    }

    if (mode === "new") {
      beginNewClientFlow();
      return;
    }

    if (!client) {
      showToast("Selecione um cliente antes de editar.");
      return;
    }

    state.clientFormMode = mode;
    state.editingClientId = mode === "new" ? "" : client.id;
    state.locationDraft = null;
    state.maintenanceView = "client";
    setClientFormError("");
    populateClientForm(mode === "new" ? null : client);

    if (!state.maintenanceOpen) {
      closeClientPanel();
      openMaintenancePanel({ preserve: true });
    } else {
      renderMaintenanceSession();
    }
  }

  function populateClientForm(client) {
    const mode = state.clientFormMode;
    const raw = client?.raw || {};
    const locationOnly = mode === "location";
    const isNew = mode === "new";

    dom.maintenanceClientForm.reset();
    state.addressAutofill = {};
    dom.maintenanceClientFields.classList.toggle("is-hidden", locationOnly);
    dom.maintenanceLocationCard.classList.toggle("is-hidden", mode === "edit");
    dom.maintenanceClientCnpj.disabled = !isNew;

    const lockedAddressFields = [
      dom.maintenanceClientUf,
      dom.maintenanceClientCity,
      dom.maintenanceClientDistrict,
      dom.maintenanceClientCep,
      dom.maintenanceClientStreet
    ];
    lockedAddressFields.forEach((field) => {
      field.disabled = !isNew;
    });

    if (client) {
      dom.maintenanceClientName.value = cleanValue(client.nomeFantasia);
      dom.maintenanceClientLegalName.value = cleanValue(client.razaoSocial);
      dom.maintenanceClientCnpj.value = cleanValue(client.cnpj);
      dom.maintenanceClientContact.value = cleanValue(raw.contato_nome);
      dom.maintenanceClientPhone.value = cleanValue(raw.telefone);
      dom.maintenanceClientWhatsapp.value = cleanValue(raw.whatsapp);
      dom.maintenanceClientEmail.value = cleanValue(raw.email);
      dom.maintenanceClientUf.value = cleanValue(client.uf);
      dom.maintenanceClientCity.value = cleanValue(client.municipio);
      dom.maintenanceClientDistrict.value = cleanValue(client.bairro);
      dom.maintenanceClientCep.value = cleanValue(client.cep);
      dom.maintenanceClientStreet.value = cleanValue(client.logradouro);
      dom.maintenanceClientNotes.value = cleanValue(raw.observacoes_comerciais);
    }

    if (isNew) {
      dom.maintenanceClientFormTitle.textContent = "Dados do novo cliente";
      dom.maintenanceClientFormNote.textContent = "O endereco e carregado pelo ponto; confira e complete somente o que faltar.";
      dom.maintenanceClientSubmit.textContent = "Cadastrar cliente";
      dom.maintenanceLocationTitle.textContent = "Ponto selecionado";
      dom.maintenancePickLocation.textContent = "Alterar ponto";
    } else if (locationOnly) {
      dom.maintenanceClientFormTitle.textContent = "Ajustar ponto";
      dom.maintenanceClientFormNote.textContent = client.displayName;
      dom.maintenanceClientSubmit.textContent = "Confirmar novo ponto";
      dom.maintenanceLocationTitle.textContent = "Novo ponto confirmado";
      dom.maintenancePickLocation.textContent = "Selecionar no mapa";
    } else {
      dom.maintenanceClientFormTitle.textContent = "Editar comunicacao";
      dom.maintenanceClientFormNote.textContent = client.displayName;
      dom.maintenanceClientSubmit.textContent = "Salvar alteracoes";
    }

    updateLocationDraftUi();
  }

  function startLocationPicker() {
    if (!canManageClients() || !["new", "location"].includes(state.clientFormMode)) return;

    state.locationPickerActive = true;
    dom.app.classList.add("is-picking-location");
    dom.locationPickerBar.classList.remove("is-hidden");
    dom.useDeviceLocation.disabled = !navigator.geolocation;
    dom.useDeviceLocation.textContent = "Minha posicao";
    closeMaintenancePanel();

    const client = getClientById(state.editingClientId);
    if (client?.hasValidCoordinates) {
      state.map.flyTo(
        [client.latitude, client.longitude],
        Math.max(state.map.getZoom(), 16),
        { duration: prefersReducedMotion() ? 0 : 0.45 }
      );
    }
  }

  function handleLocationPickerClick(event) {
    if (!state.locationPickerActive || !event?.latlng) return false;

    void confirmLocationDraft(event.latlng, {
      source: "AJUSTE_MANUAL_MAPA"
    });
    return true;
  }

  function useDeviceLocation() {
    if (!state.locationPickerActive) return;

    if (!navigator.geolocation) {
      showToast("A localizacao do aparelho nao esta disponivel neste navegador.");
      return;
    }

    dom.useDeviceLocation.disabled = true;
    dom.useDeviceLocation.textContent = "Localizando...";

    navigator.geolocation.getCurrentPosition(
      (position) => {
        dom.useDeviceLocation.disabled = false;
        dom.useDeviceLocation.textContent = "Minha posicao";
        void confirmLocationDraft(
          {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          },
          {
            source: "GPS_DISPOSITIVO",
            accuracyMeters: Number(position.coords.accuracy)
          }
        );
      },
      (error) => {
        dom.useDeviceLocation.disabled = false;
        dom.useDeviceLocation.textContent = "Minha posicao";
        const message =
          error?.code === 1
            ? "Permita o acesso a localizacao para usar a posicao do aparelho."
            : "Nao foi possivel obter a localizacao do aparelho. Marque o ponto manualmente.";
        showToast(message);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );
  }

  async function confirmLocationDraft(latlng, options = {}) {
    const latitude = Number(latlng?.lat);
    const longitude = Number(latlng?.lng);

    if (!isPointInBrazil(latitude, longitude)) {
      showToast("Selecione um ponto dentro do Brasil.");
      return;
    }

    if (state.clientFormMode === "new") {
      clearAddressAutofillFromPreviousPoint();
    }

    state.locationDraft = {
      latitude: Number(latitude.toFixed(7)),
      longitude: Number(longitude.toFixed(7)),
      source: options.source || "AJUSTE_MANUAL_MAPA",
      accuracyMeters: Number.isFinite(options.accuracyMeters)
        ? Math.round(options.accuracyMeters)
        : null,
      lookupStatus: "loading",
      lookupMessage: "",
      lookupProvider: "",
      lookupAttribution: "",
      formattedAddress: "",
      address: null
    };
    state.maintenanceView = "client";
    finishLocationPicker();
    showLocationDraftMarker();
    openMaintenancePanel({ preserve: true });
    updateLocationDraftUi();

    await resolveLocationAddress(state.locationDraft);
  }

  async function retryLocationAddress() {
    if (!state.locationDraft || state.locationDraft.lookupStatus === "loading") return;
    await resolveLocationAddress(state.locationDraft);
  }

  async function resolveLocationAddress(draft) {
    if (!draft) return;

    const latitude = draft.latitude;
    const longitude = draft.longitude;
    draft.lookupStatus = "loading";
    draft.lookupMessage = "";
    draft.lookupProvider = "";
    updateLocationDraftUi();

    try {
      const suggestion = await reverseGeocodeLocation(draft);
      if (!isCurrentLocationDraft(latitude, longitude)) return;

      draft.lookupStatus = suggestion ? "resolved" : "unavailable";
      draft.lookupMessage = suggestion
        ? ""
        : "Nenhum endereco foi encontrado para este ponto.";
      draft.lookupProvider = suggestion?.provider || "";
      draft.lookupAttribution = suggestion?.attribution || "";
      draft.formattedAddress = suggestion?.formattedAddress || "";
      draft.address = suggestion?.address || null;
      applyLocationSuggestionToForm(suggestion?.address);
    } catch (error) {
      console.warn("[Mapa de clientes] Falha ao sugerir endereco do ponto:", error);
      if (!isCurrentLocationDraft(latitude, longitude)) return;
      draft.lookupStatus = "unavailable";
      draft.lookupMessage = friendlyReverseGeocodeError(error);
      draft.lookupProvider = "";
      draft.lookupAttribution = "";
      draft.formattedAddress = "";
      draft.address = null;
    } finally {
      updateLocationDraftUi();
    }
  }

  function isCurrentLocationDraft(latitude, longitude) {
    return Boolean(
      state.locationDraft &&
      state.locationDraft.latitude === Number(latitude.toFixed(7)) &&
      state.locationDraft.longitude === Number(longitude.toFixed(7))
    );
  }

  function cancelLocationPicker() {
    if (!state.locationPickerActive) return;
    finishLocationPicker();
    if (state.clientFormMode === "new" && !state.locationDraft) {
      state.maintenanceView = "home";
    }
    openMaintenancePanel({ preserve: true });
  }

  function finishLocationPicker() {
    state.locationPickerActive = false;
    dom.app.classList.remove("is-picking-location");
    dom.locationPickerBar.classList.add("is-hidden");
  }

  function showLocationDraftMarker() {
    if (!state.locationDraft || !state.selectedLayer) return;
    state.selectedLayer.clearLayers();
    L.circleMarker(
      [state.locationDraft.latitude, state.locationDraft.longitude],
      {
        radius: 10,
        weight: 3,
        color: "#ffffff",
        fillColor: "#ff9f0a",
        fillOpacity: 1
      }
    ).addTo(state.selectedLayer);
  }

  function updateLocationDraftUi() {
    const draft = state.locationDraft;
    dom.maintenanceLocationCoordinates.textContent = draft
      ? `${draft.latitude.toFixed(7)}, ${draft.longitude.toFixed(7)}${
          draft.accuracyMeters ? ` - precisao do aparelho: ~${draft.accuracyMeters} m` : ""
        }`
      : "Nenhum ponto novo selecionado";
    dom.maintenanceLocationAddress.textContent = !draft
      ? "Marque o ponto para sugerir o endereco."
      : draft.lookupStatus === "loading"
        ? "Consultando o endereco exato deste ponto..."
        : draft.lookupStatus === "resolved" && draft.formattedAddress
          ? `Endereco sugerido pelo ponto - confira antes de salvar: ${draft.formattedAddress}`
          : draft.lookupMessage || "Endereco nao localizado automaticamente. Preencha ou confira os campos abaixo.";
    dom.maintenanceRefreshAddress.classList.toggle(
      "is-hidden",
      !draft || draft.lookupStatus === "loading"
    );
    dom.maintenanceRefreshAddress.disabled = !draft || draft.lookupStatus === "loading";
    dom.maintenanceLocationAttribution.classList.toggle(
      "is-hidden",
      !draft?.lookupAttribution
    );
    if (draft?.lookupAttribution) {
      dom.maintenanceLocationAttribution.textContent = draft.lookupAttribution;
    }
    dom.maintenanceLocationPrivacy.classList.toggle("is-hidden", !draft);
    syncClientFormSubmitState();
    dom.maintenanceLocationCard.classList.toggle("has-point", Boolean(draft));
    dom.maintenanceLocationCard.classList.toggle(
      "is-resolving",
      draft?.lookupStatus === "loading"
    );
    dom.maintenanceLocationCard.classList.toggle(
      "has-address",
      draft?.lookupStatus === "resolved"
    );
  }

  async function reverseGeocodeLocation(draft) {
    if (CONFIG.REVERSE_GEOCODING_FUNCTION && state.supabaseClient) {
      try {
        const edgeSuggestion = await reverseGeocodeWithEdgeFunction(draft);
        if (edgeSuggestion) return edgeSuggestion;
      } catch (edgeError) {
        if (!CONFIG.GOOGLE_MAPS_BROWSER_KEY) throw edgeError;
        console.warn(
          "[Mapa de clientes] Edge Function indisponivel; tentando browser key:",
          edgeError
        );
      }
    }

    const geocoder = await getGoogleGeocoder();
    if (!geocoder) return null;

    const response = await geocoder.geocode({
      location: {
        lat: draft.latitude,
        lng: draft.longitude
      },
      language: "pt-BR",
      region: "BR"
    });
    const result = selectBrazilGeocodeResult(response?.results || []);
    if (!result) return null;

    return {
      formattedAddress: cleanValue(result.formatted_address),
      address: extractAddressFromGeocodeResult(result),
      provider: "GOOGLE_MAPS_BROWSER"
    };
  }

  async function reverseGeocodeWithEdgeFunction(draft) {
    const { data, error } = await state.supabaseClient.functions.invoke(
      CONFIG.REVERSE_GEOCODING_FUNCTION,
      {
        body: {
          latitude: draft.latitude,
          longitude: draft.longitude
        }
      }
    );

    if (error) {
      throw new Error(await readFunctionError(error));
    }

    if (!data?.ok) {
      throw new Error(cleanValue(data?.error) || "Consulta de endereco indisponivel.");
    }

    if (!data.address && !data.formattedAddress) return null;
    return {
      formattedAddress: cleanValue(data.formattedAddress),
      address: data.address || null,
      provider: cleanValue(data.provider) || "EDGE_FUNCTION",
      attribution: cleanValue(data.attribution)
    };
  }

  async function readFunctionError(error) {
    try {
      const payload = await error?.context?.json?.();
      if (payload?.error) return cleanValue(payload.error);
    } catch {
      // Usa a mensagem padrao abaixo.
    }

    return cleanValue(error?.message) || "Consulta de endereco indisponivel.";
  }

  function friendlyReverseGeocodeError(error) {
    const message = cleanValue(error?.message || error);
    if (/FunctionsHttpError|FunctionsRelayError|not found|404|Failed to send a request/i.test(message)) {
      return "A funcao de endereco ainda nao foi publicada no Supabase.";
    }
    if (/GOOGLE_GEOCODING_API_KEY|Google/i.test(message)) {
      return "A chave de geocodificacao do Google ainda nao foi configurada no Supabase.";
    }
    if (/nao autorizado|unauthorized|401|403/i.test(message)) {
      return "Seu perfil nao tem autorizacao para consultar o endereco.";
    }
    return message || "Endereco nao localizado automaticamente. Preencha ou confira os campos abaixo.";
  }

  async function getGoogleGeocoder() {
    if (!CONFIG.GOOGLE_MAPS_BROWSER_KEY) return null;

    if (!state.googleGeocoderPromise) {
      state.googleGeocoderPromise = (async () => {
        if (!window.google?.maps?.importLibrary) {
          await loadGoogleMapsJavascriptApi();
        }

        const geocodingLibrary = await window.google.maps.importLibrary("geocoding");
        if (typeof geocodingLibrary?.Geocoder !== "function") {
          throw new Error("Servico de geocodificacao do Google indisponivel.");
        }

        return new geocodingLibrary.Geocoder();
      })().catch((error) => {
        state.googleGeocoderPromise = null;
        throw error;
      });
    }

    return state.googleGeocoderPromise;
  }

  function loadGoogleMapsJavascriptApi() {
    if (window.google?.maps?.importLibrary) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const existing = document.querySelector("script[data-mhs-google-maps]");
      if (existing) {
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener(
          "error",
          () => reject(new Error("Google Maps nao carregou.")),
          { once: true }
        );
        return;
      }

      const params = new URLSearchParams({
        key: CONFIG.GOOGLE_MAPS_BROWSER_KEY,
        v: "weekly",
        language: "pt-BR",
        region: "BR",
        loading: "async"
      });
      const script = document.createElement("script");
      script.dataset.mhsGoogleMaps = "true";
      script.async = true;
      script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
      script.addEventListener("load", resolve, { once: true });
      script.addEventListener(
        "error",
        () => reject(new Error("Google Maps nao carregou.")),
        { once: true }
      );
      document.head.appendChild(script);
    });
  }

  function selectBrazilGeocodeResult(results) {
    return results.find((result) => {
      const components = Array.isArray(result?.address_components)
        ? result.address_components
        : [];
      return components.some(
        (component) =>
          Array.isArray(component?.types) &&
          component.types.includes("country") &&
          cleanValue(component.short_name).toUpperCase() === "BR"
      );
    }) || results[0] || null;
  }

  function extractAddressFromGeocodeResult(result) {
    const components = Array.isArray(result?.address_components)
      ? result.address_components
      : [];
    const component = (types, property = "long_name") => {
      const found = components.find((entry) =>
        Array.isArray(entry?.types) && types.some((type) => entry.types.includes(type))
      );
      return cleanValue(found?.[property]);
    };

    const route = component(["route"]);
    const number = component(["street_number"]);
    const municipality = component([
      "administrative_area_level_2",
      "locality",
      "administrative_area_level_3"
    ]);

    return {
      logradouro: [route, number].filter(Boolean).join(", "),
      bairro: component([
        "sublocality_level_1",
        "sublocality",
        "neighborhood",
        "administrative_area_level_4"
      ]),
      municipio: municipality,
      uf: component(["administrative_area_level_1"], "short_name").toUpperCase(),
      cep: component(["postal_code"])
    };
  }

  function applyLocationSuggestionToForm(address) {
    if (state.clientFormMode !== "new" || !address) return;

    const fields = getAddressAutofillFields();
    const values = {
      uf: address.uf,
      municipio: address.municipio,
      bairro: address.bairro,
      cep: address.cep,
      logradouro: address.logradouro
    };

    for (const [key, field] of fields) {
      const value = cleanValue(values[key]);
      if (!field || field.disabled || cleanValue(field.value) || !value) continue;
      field.value = value;
      state.addressAutofill[key] = value;
    }
  }

  function clearAddressAutofillFromPreviousPoint() {
    for (const [key, field] of getAddressAutofillFields()) {
      const automaticValue = cleanValue(state.addressAutofill[key]);
      if (!automaticValue || !field) continue;
      if (cleanValue(field.value) === automaticValue) field.value = "";
    }
    state.addressAutofill = {};
  }

  function getAddressAutofillFields() {
    return [
      ["uf", dom.maintenanceClientUf],
      ["municipio", dom.maintenanceClientCity],
      ["bairro", dom.maintenanceClientDistrict],
      ["cep", dom.maintenanceClientCep],
      ["logradouro", dom.maintenanceClientStreet]
    ];
  }

  function isPointInBrazil(latitude, longitude) {
    return Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      latitude >= BRAZIL_BOUNDS[0][0] &&
      latitude <= BRAZIL_BOUNDS[1][0] &&
      longitude >= BRAZIL_BOUNDS[0][1] &&
      longitude <= BRAZIL_BOUNDS[1][1];
  }

  async function handleClientFormSubmit(event) {
    event.preventDefault();
    if (!state.supabaseClient || !state.operator) return;

    const mode = state.clientFormMode;
    if (mode === "new" && state.locationDraft?.lookupStatus === "loading") {
      setClientFormError("Aguarde a consulta automatica do endereco terminar.");
      return;
    }
    if (["new", "location"].includes(mode) && !state.locationDraft) {
      setClientFormError("Selecione e confira o ponto no mapa antes de salvar.");
      return;
    }

    setClientFormBusy(true);
    setClientFormError("");

    try {
      let response;
      if (mode === "new") {
        response = await state.supabaseClient
          .schema(CONFIG.SCHEMA_NAME)
          .rpc("cadastrar_cliente", { p_dados: buildNewClientPayload() });
      } else if (mode === "edit") {
        response = await state.supabaseClient
          .schema(CONFIG.SCHEMA_NAME)
          .rpc("atualizar_comunicacao", {
            p_cliente_id: state.editingClientId,
            p_dados: buildCommunicationPayload()
          });
      } else {
        response = await state.supabaseClient
          .schema(CONFIG.SCHEMA_NAME)
          .rpc("confirmar_localizacao", {
            p_cliente_id: state.editingClientId,
            p_latitude: state.locationDraft.latitude,
            p_longitude: state.locationDraft.longitude,
            p_fonte: state.locationDraft.source || "AJUSTE_MANUAL_MAPA",
            p_precisao_m: state.locationDraft.accuracyMeters,
            p_observacao: buildLocationDraftObservation()
          });
      }

      if (response.error) throw response.error;
      const savedId = cleanValue(response.data?.[0]?.cliente_id) || state.editingClientId;

      await reloadClientsData();
      await loadMaintenanceActivity();
      state.maintenanceView = "home";
      state.locationDraft = null;
      closeMaintenancePanel();

      const savedClient = getClientById(savedId);
      if (savedClient) openClient(savedClient, { focusMap: true });

      showToast(
        mode === "new"
          ? "Cliente cadastrado com sucesso."
          : mode === "edit"
            ? "Dados de comunicacao atualizados."
            : "Novo ponto confirmado e salvo."
      );
    } catch (error) {
      console.error("[Mapa de clientes] Falha ao salvar manutencao:", error);
      setClientFormError(friendlyMutationError(error));
    } finally {
      setClientFormBusy(false);
    }
  }

  function buildNewClientPayload() {
    return {
      nome_fantasia: cleanValue(dom.maintenanceClientName.value),
      razao_social: cleanValue(dom.maintenanceClientLegalName.value),
      cnpj: cleanValue(dom.maintenanceClientCnpj.value),
      contato_nome: cleanValue(dom.maintenanceClientContact.value),
      telefone: cleanValue(dom.maintenanceClientPhone.value),
      whatsapp: cleanValue(dom.maintenanceClientWhatsapp.value),
      email: cleanValue(dom.maintenanceClientEmail.value),
      uf: cleanValue(dom.maintenanceClientUf.value).toUpperCase(),
      municipio: cleanValue(dom.maintenanceClientCity.value),
      bairro: cleanValue(dom.maintenanceClientDistrict.value),
      cep: cleanValue(dom.maintenanceClientCep.value),
      logradouro: cleanValue(dom.maintenanceClientStreet.value),
      observacoes_comerciais: cleanValue(dom.maintenanceClientNotes.value),
      latitude: state.locationDraft.latitude,
      longitude: state.locationDraft.longitude,
      localizacao_fonte: state.locationDraft.source || "AJUSTE_MANUAL_MAPA",
      localizacao_precisao_m: state.locationDraft.accuracyMeters,
      localizacao_observacao: buildLocationDraftObservation()
    };
  }

  function buildLocationDraftObservation() {
    const formattedAddress = cleanValue(state.locationDraft?.formattedAddress);
    const source = state.locationDraft?.source === "GPS_DISPOSITIVO"
      ? "Posicao obtida pelo aparelho e confirmada pela equipe."
      : "Ponto marcado e confirmado pela equipe no mapa.";
    return formattedAddress
      ? `${source} Endereco sugerido: ${formattedAddress}`.slice(0, 1000)
      : source;
  }

  function buildCommunicationPayload() {
    return {
      nome_fantasia: cleanValue(dom.maintenanceClientName.value),
      razao_social: cleanValue(dom.maintenanceClientLegalName.value),
      contato_nome: cleanValue(dom.maintenanceClientContact.value),
      telefone: cleanValue(dom.maintenanceClientPhone.value),
      whatsapp: cleanValue(dom.maintenanceClientWhatsapp.value),
      email: cleanValue(dom.maintenanceClientEmail.value),
      observacoes_comerciais: cleanValue(dom.maintenanceClientNotes.value)
    };
  }

  async function reloadClientsData() {
    const rawRows = await fetchAllRows();
    state.clients = rawRows.map(normalizeClient).filter(Boolean);
    buildCoordinateCounts();
    applyVisualSpread();
    buildMarkers();
    populateFilterOptions();
    refreshMunicipioOptions();
    applyFilters({ fit: false });

    const invalidCoordinates = state.clients.filter(
      (client) => !client.hasValidCoordinates
    ).length;
    dom.dataCaption.textContent = invalidCoordinates > 0
      ? `${formatNumber(state.clients.length)} registros • ${formatNumber(invalidCoordinates)} sem coordenada`
      : `${formatNumber(state.clients.length)} registros carregados`;
  }

  function getClientById(id) {
    return state.clients.find((client) => String(client.id) === String(id)) || null;
  }

  function setClientFormBusy(busy) {
    dom.maintenanceClientSubmit.dataset.busy = busy ? "true" : "false";
    dom.maintenanceClientSubmit.disabled = busy || shouldWaitForLocationAddress();
    if (busy) {
      dom.maintenanceClientSubmit.textContent = "Salvando...";
      return;
    }

    dom.maintenanceClientSubmit.textContent =
      state.clientFormMode === "new"
        ? "Cadastrar cliente"
        : state.clientFormMode === "edit"
          ? "Salvar alteracoes"
          : "Confirmar novo ponto";
  }

  function shouldWaitForLocationAddress() {
    return Boolean(
      state.clientFormMode === "new" &&
      state.locationDraft?.lookupStatus === "loading"
    );
  }

  function syncClientFormSubmitState() {
    if (!dom.maintenanceClientSubmit) return;
    const busy = dom.maintenanceClientSubmit.dataset.busy === "true";
    dom.maintenanceClientSubmit.disabled = busy || shouldWaitForLocationAddress();
  }

  function setClientFormError(message) {
    dom.maintenanceClientError.textContent = message;
    dom.maintenanceClientError.classList.toggle("is-hidden", !message);
  }

  function friendlyMutationError(error) {
    const message = String(error?.message || error || "");
    if (/Ja existe cliente com este CNPJ/i.test(message)) return "Este CNPJ ja esta cadastrado.";
    if (/Operador nao autorizado/i.test(message)) return "Seu perfil nao possui permissao para esta operacao.";
    if (/Coordenada fora/i.test(message)) return "O ponto selecionado esta fora dos limites do Brasil.";
    if (/Informe nome fantasia/i.test(message)) return "Informe o nome fantasia ou a razao social.";
    if (/schema cache|function.*not found/i.test(message)) return "O Supabase ainda nao atualizou as funcoes. Aguarde alguns segundos e tente novamente.";
    return message || "Nao foi possivel salvar a alteracao.";
  }

  async function loadMaintenanceActivity() {
    if (!state.supabaseClient || !state.operator) return;

    const { data, error } = await state.supabaseClient
      .schema(CONFIG.SCHEMA_NAME)
      .from("vw_atividade_clientes")
      .select("evento_id, ocorrido_em, tipo_evento, cliente_id, cliente, municipio, uf, operador")
      .order("ocorrido_em", { ascending: false })
      .limit(20);

    if (error) {
      console.error("[Mapa de clientes] Falha ao carregar atividade:", error);
      state.maintenanceActivity = [];
      return;
    }

    state.maintenanceActivity = Array.isArray(data) ? data : [];
  }

  function renderMaintenanceActivity() {
    dom.maintenanceActivityList.replaceChildren();
    dom.maintenanceActivityCount.textContent = formatNumber(state.maintenanceActivity.length);

    if (!state.maintenanceActivity.length) {
      const empty = document.createElement("p");
      empty.className = "maintenance-message is-neutral";
      empty.textContent = "Nenhuma alteracao registrada ainda.";
      dom.maintenanceActivityList.appendChild(empty);
      return;
    }

    state.maintenanceActivity.forEach((activity) => {
      const item = document.createElement("article");
      item.className = "maintenance-activity-item";

      const copy = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = cleanValue(activity.cliente) || "Cliente";
      const meta = document.createElement("small");
      meta.textContent = [
        [activity.municipio, activity.uf].filter(Boolean).join(" - "),
        formatActivityDate(activity.ocorrido_em),
        cleanValue(activity.operador)
      ].filter(Boolean).join(" • ");
      copy.append(title, meta);

      const type = document.createElement("span");
      type.textContent = formatActivityType(activity.tipo_evento);
      item.append(copy, type);
      dom.maintenanceActivityList.appendChild(item);
    });
  }

  function setMaintenanceBusy(busy) {
    dom.maintenanceLoginSubmit.disabled = busy;
    dom.maintenanceLoginSubmit.textContent = busy ? "Entrando..." : "Entrar";
    dom.maintenanceSignOut.disabled = busy;
  }

  function setMaintenanceError(message) {
    dom.maintenanceLoginError.textContent = message;
    dom.maintenanceLoginError.classList.toggle("is-hidden", !message);
  }

  function friendlyAuthError(error) {
    const message = String(error?.message || error || "");
    if (/invalid login credentials/i.test(message)) return "E-mail ou senha incorretos.";
    if (/email not confirmed/i.test(message)) return "Confirme o e-mail antes de entrar.";
    if (/perfil ativo de operador/i.test(message)) return message;
    if (/failed to fetch|network/i.test(message)) return "Falha de rede ao autenticar.";
    return message || "Nao foi possivel iniciar a sessao.";
  }

  function getInitialsFromText(value) {
    const words = cleanValue(value).split(/\s+/).filter(Boolean);
    if (!words.length) return "OP";
    return `${words[0][0] || ""}${words[1]?.[0] || words[0][1] || ""}`
      .toUpperCase()
      .slice(0, 2);
  }

  function formatActivityDate(value) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "";
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  function formatActivityType(value) {
    const type = cleanValue(value).toUpperCase();
    if (type === "CADASTRO") return "Novo";
    if (type === "REPOSICIONAMENTO") return "Ponto";
    if (type === "GEOCODIFICACAO") return "Geo";
    return "Atualizado";
  }

  function handleReportTabClick(event) {
    const button = event.target.closest("[data-report-tab]");
    if (!button) return;
    setReportTab(button.dataset.reportTab);
  }

  function setReportTab(tab) {
    if (!["overview", "territory", "quality"].includes(tab)) return;
    state.reportTab = tab;
    syncReportTabs();
  }

  function syncReportTabs() {
    const tabs = dom.reportTabs.querySelectorAll("[data-report-tab]");
    const panels = dom.reportPanel.querySelectorAll("[data-report-panel]");

    tabs.forEach((button) => {
      const active = button.dataset.reportTab === state.reportTab;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });

    panels.forEach((panel) => {
      panel.classList.toggle("is-active", panel.dataset.reportPanel === state.reportTab);
    });
  }

  function renderReport() {
    if (!dom.reportPanel) return;

    const clients = state.filteredClients || [];
    const total = clients.length;
    const baseTotal = state.clients.length;
    const mapped = clients.filter((client) => client.hasValidCoordinates).length;
    const unmapped = total - mapped;
    const active = clients.filter(
      (client) => normalizeSearchText(client.situacao) === "ativa"
    ).length;
    const cityEntries = getLocationEntries(clients);
    const districtEntries = getDistrictEntries(clients);
    const streetEntries = getStreetEntries(clients);
    const geocodeEntries = getGeocodePrecisionEntries(clients);
    const cnaeEntries = getCnaeEntries(clients);
    const ufEntries = getCountEntries(
      clients,
      (client) => client.uf,
      "Sem UF"
    );
    const statusEntries = getCountEntries(
      clients,
      (client) => client.situacao,
      "Sem situacao"
    );
    const coordinateStats = getCoordinateDistribution(clients);
    const topCity = cityEntries[0];
    const hasScopedFilters =
      Boolean(state.areaSelection) ||
      Boolean(state.searchQuery) ||
      Boolean(state.filters.uf) ||
      Boolean(state.filters.municipio) ||
      Boolean(state.filters.situacao);

    syncAreaSelectionUi();

    dom.reportContext.textContent = baseTotal
      ? `${formatNumber(total)} de ${formatNumber(baseTotal)} clientes analisados ${
          hasScopedFilters ? "nos filtros atuais" : "na base completa"
        }.`
      : "Carregue a base para visualizar os indicadores.";

    dom.reportTotalValue.textContent = formatNumber(total);
    dom.reportTotalNote.textContent =
      active && total
        ? `${formatPercent(active, total)} ativos na selecao`
        : "Base atual";

    dom.reportCoverageValue.textContent = formatPercent(mapped, total);
    dom.reportCoverageNote.textContent = `${formatNumber(mapped)} ponto(s) com coordenada`;

    dom.reportActiveValue.textContent = formatPercent(active, total);
    dom.reportActiveNote.textContent = `${formatNumber(active)} cliente(s) ativos`;

    dom.reportUnmappedValue.textContent = formatNumber(unmapped);
    dom.reportUnmappedNote.textContent = unmapped
      ? `${formatPercent(unmapped, total)} da selecao sem mapa`
      : "Todos os clientes mapeados";

    dom.reportCitiesValue.textContent = formatNumber(cityEntries.length);
    dom.reportCitiesNote.textContent =
      cityEntries.length === 1 ? "Municipio representado" : "Municipios representados";

    dom.reportStatesValue.textContent = formatNumber(ufEntries.length);
    dom.reportStatesNote.textContent =
      ufEntries.length === 1 ? "UF representada" : "UFs representadas";

    dom.reportTopCityValue.textContent = topCity ? topCity.label : "-";
    dom.reportTopCityNote.textContent = topCity
      ? `${formatNumber(topCity.count)} clientes - ${formatPercent(topCity.count, total)} da selecao`
      : "Sem dados suficientes";

    dom.reportSharedValue.textContent = formatNumber(coordinateStats.sharedGroups);
    dom.reportSharedNote.textContent = coordinateStats.sharedClients
      ? `${formatNumber(coordinateStats.sharedClients)} clientes em pontos compartilhados`
      : "Sem concentracao no mesmo ponto";

    dom.reportEmpty.classList.toggle("is-hidden", total > 0);
    dom.reportTopCaption.textContent = cityEntries.length
      ? `Top ${Math.min(8, cityEntries.length)}`
      : "Sem dados";
    dom.reportDistrictCaption.textContent = districtEntries.length
      ? `Top ${Math.min(10, districtEntries.length)}`
      : "Sem dados";

    renderBarChart(dom.chartTopCities, cityEntries.slice(0, 8), total, {
      emptyText: "Sem municipios para exibir."
    });
    renderStatusChart(dom.chartStatus, statusEntries, total);
    renderBarChart(dom.chartUf, ufEntries.slice(0, 8), total, {
      compact: true,
      emptyText: "Sem UFs para exibir."
    });
    renderCoordinateChart(dom.chartCoordinateGroups, coordinateStats);
    renderDensityList(dom.reportDensityList, cityEntries.slice(0, 6), total);
    renderBarChart(dom.chartTopDistricts, districtEntries.slice(0, 10), total, {
      emptyText: "Sem bairros para exibir."
    });
    renderBarChart(dom.chartTopStreets, streetEntries.slice(0, 8), total, {
      compact: true,
      emptyText: "Sem logradouros para exibir."
    });
    renderRankingTable(dom.reportRankingTable, cityEntries.slice(0, 14), total);
    renderCoverageTable(dom.reportCoverageTable, ufEntries.slice(0, 12), clients);
    renderInsights(dom.reportInsights, buildReportInsights({
      total,
      mapped,
      unmapped,
      active,
      cityEntries,
      districtEntries,
      coordinateStats
    }));
    renderBarChart(dom.chartGeocodeQuality, geocodeEntries.slice(0, 8), total, {
      compact: true,
      emptyText: "Sem classificacao de precisao."
    });
    renderQualityTable(dom.reportQualityTable, getFieldQualityRows(clients, total));
    renderBarChart(dom.chartCnae, cnaeEntries.slice(0, 8), total, {
      compact: true,
      emptyText: "Sem CNAEs para exibir."
    });
  }

  function getLocationEntries(clients) {
    const groups = new Map();

    for (const client of clients) {
      const municipio = cleanValue(client.municipio) || "Sem municipio";
      const uf = cleanValue(client.uf);
      const key = `${municipio}|${uf}`;
      const label = uf ? `${municipio} - ${uf}` : municipio;
      const entry = groups.get(key) || {
        key,
        label,
        count: 0,
        active: 0,
        mapped: 0
      };

      entry.count += 1;
      if (client.hasValidCoordinates) entry.mapped += 1;
      if (normalizeSearchText(client.situacao) === "ativa") entry.active += 1;
      groups.set(key, entry);
    }

    return sortReportEntries(Array.from(groups.values()));
  }

  function getDistrictEntries(clients) {
    const groups = new Map();

    for (const client of clients) {
      const bairro = cleanValue(client.bairro);
      if (!bairro) continue;

      const municipio = cleanValue(client.municipio);
      const uf = cleanValue(client.uf);
      const key = `${normalizeLookupText(bairro)}|${normalizeLookupText(municipio)}|${uf}`;
      const location = [municipio, uf].filter(Boolean).join(" - ");
      const entry = groups.get(key) || {
        key,
        label: location ? `${bairro} - ${location}` : bairro,
        count: 0,
        active: 0,
        mapped: 0
      };

      entry.count += 1;
      if (client.hasValidCoordinates) entry.mapped += 1;
      if (normalizeSearchText(client.situacao) === "ativa") entry.active += 1;
      groups.set(key, entry);
    }

    return sortReportEntries(Array.from(groups.values()));
  }

  function getStreetEntries(clients) {
    const groups = new Map();

    for (const client of clients) {
      const street = cleanValue(client.logradouro);
      if (!street) continue;

      const bairro = cleanValue(client.bairro);
      const municipio = cleanValue(client.municipio);
      const uf = cleanValue(client.uf);
      const key = [
        normalizeLookupText(street),
        normalizeLookupText(bairro),
        normalizeLookupText(municipio),
        uf
      ].join("|");
      const location = [bairro, municipio, uf].filter(Boolean).join(" - ");
      const entry = groups.get(key) || {
        key,
        label: location ? `${street} - ${location}` : street,
        count: 0,
        active: 0,
        mapped: 0
      };

      entry.count += 1;
      if (client.hasValidCoordinates) entry.mapped += 1;
      if (normalizeSearchText(client.situacao) === "ativa") entry.active += 1;
      groups.set(key, entry);
    }

    return sortReportEntries(Array.from(groups.values()));
  }

  function getGeocodePrecisionEntries(clients) {
    return getCountEntries(
      clients,
      (client) => getPrecisionMeta(client.geocodeStatus).title,
      "Precisao nao classificada"
    );
  }

  function getPrecisionMeta(status) {
    return PRECISION_META[status] || PRECISION_META.SEM_STATUS;
  }

  function getCnaeEntries(clients) {
    return getCountEntries(
      clients,
      (client) => client.cnae,
      "Sem atividade"
    );
  }

  function getCountEntries(clients, getter, fallbackLabel) {
    const groups = new Map();

    for (const client of clients) {
      const label = cleanValue(getter(client)) || fallbackLabel;
      groups.set(label, (groups.get(label) || 0) + 1);
    }

    return sortReportEntries(
      Array.from(groups, ([label, count]) => ({
        key: label,
        label,
        count
      }))
    );
  }

  function sortReportEntries(entries) {
    return entries.sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return String(a.label).localeCompare(String(b.label), "pt-BR", {
        sensitivity: "base",
        numeric: true
      });
    });
  }

  function getCoordinateDistribution(clients) {
    const groups = new Map();

    for (const client of clients) {
      if (!client.hasValidCoordinates || !client.coordinateKey) continue;
      groups.set(client.coordinateKey, (groups.get(client.coordinateKey) || 0) + 1);
    }

    const bins = [
      { label: "1", detail: "por ponto", min: 1, max: 1, groups: 0, clients: 0 },
      { label: "2-4", detail: "por ponto", min: 2, max: 4, groups: 0, clients: 0 },
      { label: "5-9", detail: "por ponto", min: 5, max: 9, groups: 0, clients: 0 },
      { label: "10-24", detail: "por ponto", min: 10, max: 24, groups: 0, clients: 0 },
      { label: "25+", detail: "por ponto", min: 25, max: Infinity, groups: 0, clients: 0 }
    ];

    let sharedGroups = 0;
    let sharedClients = 0;

    for (const count of groups.values()) {
      const bin = bins.find((item) => count >= item.min && count <= item.max);
      if (!bin) continue;
      bin.groups += 1;
      bin.clients += count;

      if (count > 1) {
        sharedGroups += 1;
        sharedClients += count;
      }
    }

    return {
      bins,
      sharedGroups,
      sharedClients,
      uniquePoints: groups.size
    };
  }

  function renderBarChart(container, entries, total, options = {}) {
    container.replaceChildren();

    if (!entries.length || !total) {
      container.appendChild(createReportEmpty(options.emptyText || "Sem dados para exibir."));
      return;
    }

    const max = Math.max(...entries.map((entry) => entry.count), 1);

    for (const entry of entries) {
      const row = document.createElement("div");
      row.className = options.compact ? "bar-row is-compact" : "bar-row";

      const heading = document.createElement("div");
      heading.className = "bar-row-heading";

      const label = document.createElement("span");
      label.textContent = entry.label;

      const value = document.createElement("strong");
      value.textContent = formatNumber(entry.count);

      heading.append(label, value);

      const track = document.createElement("div");
      track.className = "bar-track";

      const fill = document.createElement("span");
      fill.style.width = `${Math.max(4, (entry.count / max) * 100)}%`;
      track.appendChild(fill);

      const meta = document.createElement("small");
      meta.textContent = `${formatPercent(entry.count, total)} da selecao`;

      row.append(heading, track, meta);
      container.appendChild(row);
    }
  }

  function renderStatusChart(container, entries, total) {
    container.replaceChildren();

    if (!entries.length || !total) {
      container.appendChild(createReportEmpty("Sem situacoes para exibir."));
      return;
    }

    const colors = ["#007aff", "#248a3d", "#b26a00", "#5e5ce6", "#8e8e93"];
    const segments = compactReportEntries(entries, 5);
    let cursor = 0;

    const gradient = segments
      .map((entry, index) => {
        const start = cursor;
        const end = cursor + (entry.count / total) * 100;
        cursor = end;
        return `${colors[index % colors.length]} ${start}% ${end}%`;
      })
      .join(", ");

    const donut = document.createElement("div");
    donut.className = "status-donut";
    donut.style.background = `conic-gradient(${gradient})`;

    const center = document.createElement("span");
    const activeEntry = entries.find(
      (entry) => normalizeSearchText(entry.label) === "ativa"
    );
    center.innerHTML = `<strong>${formatPercent(activeEntry?.count || 0, total)}</strong><small>ativas</small>`;
    donut.appendChild(center);

    const legend = document.createElement("div");
    legend.className = "status-legend";

    segments.forEach((entry, index) => {
      const item = document.createElement("div");
      item.className = "legend-item";

      const swatch = document.createElement("span");
      swatch.style.background = colors[index % colors.length];

      const label = document.createElement("strong");
      label.textContent = entry.label;

      const value = document.createElement("small");
      value.textContent = `${formatNumber(entry.count)} - ${formatPercent(entry.count, total)}`;

      item.append(swatch, label, value);
      legend.appendChild(item);
    });

    container.append(donut, legend);
  }

  function compactReportEntries(entries, limit) {
    if (entries.length <= limit) return entries;

    const visible = entries.slice(0, limit - 1);
    const hiddenCount = entries
      .slice(limit - 1)
      .reduce((sum, entry) => sum + entry.count, 0);

    return [
      ...visible,
      {
        key: "Outras",
        label: "Outras",
        count: hiddenCount
      }
    ];
  }

  function renderCoordinateChart(container, stats) {
    container.replaceChildren();

    if (!stats.uniquePoints) {
      container.appendChild(createReportEmpty("Sem pontos com coordenadas validas."));
      return;
    }

    const maxClients = Math.max(...stats.bins.map((bin) => bin.clients), 1);

    for (const bin of stats.bins) {
      const item = document.createElement("div");
      item.className = "column-item";

      const column = document.createElement("div");
      column.className = "column-track";

      const fill = document.createElement("span");
      fill.style.height = bin.clients ? `${Math.max(8, (bin.clients / maxClients) * 100)}%` : "0%";
      column.appendChild(fill);

      const label = document.createElement("strong");
      label.textContent = bin.label;

      const detail = document.createElement("small");
      detail.textContent = bin.clients
        ? `${formatNumber(bin.clients)} clientes`
        : "0 clientes";

      item.append(column, label, detail);
      container.appendChild(item);
    }
  }

  function renderDensityList(container, entries, total) {
    container.replaceChildren();

    if (!entries.length || !total) {
      container.appendChild(createReportEmpty("Sem hotspots para exibir."));
      return;
    }

    entries.forEach((entry, index) => {
      const row = document.createElement("div");
      row.className = "density-row";

      const rank = document.createElement("span");
      rank.className = "density-rank";
      rank.textContent = String(index + 1).padStart(2, "0");

      const copy = document.createElement("div");
      copy.className = "density-copy";

      const title = document.createElement("strong");
      title.textContent = entry.label;

      const meta = document.createElement("small");
      meta.textContent = `${formatNumber(entry.count)} clientes, ${formatPercent(
        entry.count,
        total
      )} da selecao`;

      copy.append(title, meta);

      const score = document.createElement("div");
      score.className = "density-score";
      score.textContent = formatPercent(entry.count, total);

      row.append(rank, copy, score);
      container.appendChild(row);
    });
  }

  function renderRankingTable(container, entries, total) {
    container.replaceChildren();

    if (!entries.length || !total) {
      container.appendChild(createReportEmpty("Sem ranking para exibir."));
      return;
    }

    const table = createReportTable([
      "Pos.",
      "Municipio",
      "Clientes",
      "Ativos",
      "Mapa",
      "Part."
    ]);

    const tbody = table.querySelector("tbody");
    entries.forEach((entry, index) => {
      const row = document.createElement("tr");
      [
        String(index + 1).padStart(2, "0"),
        entry.label,
        formatNumber(entry.count),
        formatPercent(entry.active || 0, entry.count),
        formatPercent(entry.mapped || 0, entry.count),
        formatPercent(entry.count, total)
      ].forEach((value) => {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.appendChild(cell);
      });
      tbody.appendChild(row);
    });

    container.appendChild(table);
  }

  function renderCoverageTable(container, entries, clients) {
    container.replaceChildren();

    if (!entries.length || !clients.length) {
      container.appendChild(createReportEmpty("Sem UFs para avaliar."));
      return;
    }

    const table = createReportTable(["UF", "Clientes", "Cidades", "Mapa"]);
    const tbody = table.querySelector("tbody");

    entries.forEach((entry) => {
      const ufClients = clients.filter((client) =>
        entry.label === "Sem UF" ? !client.uf : client.uf === entry.label
      );
      const cityCount = uniqueSorted(ufClients.map((client) => client.municipio)).length;
      const mapped = ufClients.filter((client) => client.hasValidCoordinates).length;
      const row = document.createElement("tr");

      [
        entry.label,
        formatNumber(entry.count),
        formatNumber(cityCount),
        formatPercent(mapped, entry.count)
      ].forEach((value) => {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.appendChild(cell);
      });

      tbody.appendChild(row);
    });

    container.appendChild(table);
  }

  function renderQualityTable(container, rows) {
    container.replaceChildren();

    if (!rows.length) {
      container.appendChild(createReportEmpty("Sem campos para avaliar."));
      return;
    }

    const table = createReportTable(["Campo", "Ausentes", "Cobertura"]);
    const tbody = table.querySelector("tbody");

    rows.forEach((item) => {
      const row = document.createElement("tr");
      [item.label, formatNumber(item.missing), item.coverage].forEach((value) => {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.appendChild(cell);
      });
      tbody.appendChild(row);
    });

    container.appendChild(table);
  }

  function createReportTable(headers) {
    const table = document.createElement("table");
    table.className = "report-table";

    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    headers.forEach((header) => {
      const cell = document.createElement("th");
      cell.scope = "col";
      cell.textContent = header;
      headRow.appendChild(cell);
    });
    thead.appendChild(headRow);

    const tbody = document.createElement("tbody");
    table.append(thead, tbody);
    return table;
  }

  function renderInsights(container, insights) {
    container.replaceChildren();

    if (!insights.length) {
      container.appendChild(createReportEmpty("Sem insights para a selecao atual."));
      return;
    }

    insights.forEach((insight) => {
      const row = document.createElement("div");
      row.className = `insight-row ${insight.tone ? `is-${insight.tone}` : ""}`.trim();

      const marker = document.createElement("span");
      marker.className = "insight-marker";
      marker.setAttribute("aria-hidden", "true");

      const copy = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = insight.title;
      const text = document.createElement("small");
      text.textContent = insight.text;
      copy.append(title, text);

      row.append(marker, copy);
      container.appendChild(row);
    });
  }

  function buildReportInsights({
    total,
    mapped,
    unmapped,
    active,
    cityEntries,
    districtEntries,
    coordinateStats
  }) {
    if (!total) return [];

    const insights = [];
    const topCity = cityEntries[0];
    const topDistrict = districtEntries[0];

    if (state.areaSelection) {
      insights.push({
        tone: "focus",
        title: "Recorte espacial ativo",
        text: `${formatNumber(total)} cliente(s) estao sendo analisados dentro da area selecionada.`
      });
    }

    if (topCity) {
      insights.push({
        tone: "focus",
        title: "Concentracao principal",
        text: `${topCity.label} concentra ${formatPercent(topCity.count, total)} da selecao.`
      });
    }

    if (topDistrict) {
      insights.push({
        tone: "neutral",
        title: "Bairro de maior presenca",
        text: `${topDistrict.label} aparece com ${formatNumber(topDistrict.count)} cliente(s).`
      });
    }

    if (unmapped) {
      insights.push({
        tone: "warning",
        title: "Coordenadas pendentes",
        text: `${formatNumber(unmapped)} registro(s) nao aparecem no mapa e reduzem a leitura territorial.`
      });
    } else if (mapped) {
      insights.push({
        tone: "success",
        title: "Cobertura geografica completa",
        text: "Todos os clientes da selecao possuem coordenadas validas."
      });
    }

    if (coordinateStats.sharedClients) {
      insights.push({
        tone: "warning",
        title: "Pontos com alta sobreposicao",
        text: `${formatNumber(coordinateStats.sharedClients)} cliente(s) dividem coordenadas com outros registros.`
      });
    }

    insights.push({
      tone: active / total >= 0.75 ? "success" : "neutral",
      title: "Carteira ativa",
      text: `${formatPercent(active, total)} dos clientes analisados estao ativos.`
    });

    return insights.slice(0, 6);
  }

  function getFieldQualityRows(clients, total) {
    if (!total) return [];

    return [
      {
        label: "Coordenada",
        missing: clients.filter((client) => !client.hasValidCoordinates).length
      },
      {
        label: "CNPJ",
        missing: clients.filter((client) => !client.cnpj).length
      },
      {
        label: "Logradouro",
        missing: clients.filter((client) => !client.logradouro).length
      },
      {
        label: "Bairro",
        missing: clients.filter((client) => !client.bairro).length
      },
      {
        label: "Telefone",
        missing: clients.filter((client) => !client.telefone && !client.telefone1).length
      },
      {
        label: "CNAE",
        missing: clients.filter((client) => !client.cnae).length
      }
    ].map((item) => ({
      ...item,
      coverage: formatPercent(total - item.missing, total)
    }));
  }

  function getReportScopeLabel() {
    if (state.searchQuery) return `Busca: ${state.searchQuery}`;

    const parts = [
      state.filters.uf ? `UF ${state.filters.uf}` : "",
      state.filters.municipio || "",
      state.filters.situacao || ""
    ].filter(Boolean);

    return parts.length ? parts.join(" / ") : "Base completa";
  }

  function getReportScopeNote() {
    const total = state.filteredClients.length;
    const baseTotal = state.clients.length;
    return baseTotal
      ? `${formatNumber(total)} de ${formatNumber(baseTotal)} cliente(s) no escopo atual.`
      : "Carregue a base para gerar os indicadores.";
  }

  function exportFilteredClients() {
    exportClientsCsv(state.filteredClients, "clientes_filtrados");
  }

  function exportAreaClients() {
    if (!state.areaSelection) {
      showToast("Selecione uma area visivel antes de exportar.");
      return;
    }

    exportClientsCsv(state.filteredClients, "clientes_area_visivel");
  }

  function exportHotspots() {
    const clients = state.filteredClients || [];
    const entries = getLocationEntries(clients);

    if (!entries.length) {
      showToast("Nao ha hotspots para exportar.");
      return;
    }

    const rows = entries.map((entry, index) => ({
      ranking: index + 1,
      municipio: entry.label,
      clientes: entry.count,
      ativos: entry.active || 0,
      com_coordenada: entry.mapped || 0,
      participacao: formatPercent(entry.count, clients.length)
    }));

    downloadCsv("hotspots_clientes", rows, [
      "ranking",
      "municipio",
      "clientes",
      "ativos",
      "com_coordenada",
      "participacao"
    ]);
  }

  function exportClientsCsv(clients, token) {
    const rows = (clients || []).map((client) => ({
      cnpj: client.cnpj,
      razao_social: client.razaoSocial,
      nome_fantasia: client.nomeFantasia,
      situacao: client.situacao,
      uf: client.uf,
      municipio: client.municipio,
      bairro: client.bairro,
      logradouro: client.logradouro,
      cep: formatCep(client.cep),
      telefone: uniqueSorted([client.telefone, client.telefone1].filter(Boolean).map(formatPhone)).join(" | "),
      cnae: client.cnae,
      geocode_status: client.geocodeStatus,
      precisao: getPrecisionMeta(client.geocodeStatus).title,
      latitude: client.hasValidCoordinates ? String(client.latitude) : "",
      longitude: client.hasValidCoordinates ? String(client.longitude) : "",
      ponto_visual_latitude: client.hasValidCoordinates ? String(client.visualLatitude) : "",
      ponto_visual_longitude: client.hasValidCoordinates ? String(client.visualLongitude) : "",
      clientes_no_mesmo_ponto: client.visualGroupSize || 0,
      google_maps: buildGoogleMapsUrl(client)
    }));

    if (!rows.length) {
      showToast("Nao ha clientes para exportar neste escopo.");
      return;
    }

    downloadCsv(token, rows, [
      "cnpj",
      "razao_social",
      "nome_fantasia",
      "situacao",
      "uf",
      "municipio",
      "bairro",
      "logradouro",
      "cep",
      "telefone",
      "cnae",
      "geocode_status",
      "precisao",
      "latitude",
      "longitude",
      "ponto_visual_latitude",
      "ponto_visual_longitude",
      "clientes_no_mesmo_ponto",
      "google_maps"
    ]);
  }

  function downloadCsv(token, rows, columns) {
    const csv = serializeCsv(rows, columns);
    const blob = new Blob(["\ufeff", csv], {
      type: "text/csv;charset=utf-8"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `${token}_${getExportDateStamp()}.csv`;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(() => URL.revokeObjectURL(url), 250);
    showToast("CSV gerado com sucesso.");
  }

  function serializeCsv(rows, columns) {
    const header = columns.map(formatCsvCell).join(";");
    const lines = rows.map((row) =>
      columns.map((column) => formatCsvCell(row[column])).join(";")
    );

    return [header, ...lines].join("\r\n");
  }

  function formatCsvCell(value) {
    const text = cleanValue(value).replace(/\r?\n/g, " ");
    return `"${text.replace(/"/g, '""')}"`;
  }

  function getExportDateStamp() {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, "0");
    return [
      now.getFullYear(),
      pad(now.getMonth() + 1),
      pad(now.getDate())
    ].join("");
  }

  function createReportEmpty(text) {
    const empty = document.createElement("div");
    empty.className = "chart-empty";
    empty.textContent = text;
    return empty;
  }

  async function connectAndLoad() {
    if (state.loading) return;

    state.loading = true;
    showLoadingStatus("Conectando ao Supabase", "Preparando sua base de clientes…");

    try {
      if (!window.supabase?.createClient) {
        throw new Error(
          "O cliente oficial do Supabase não foi carregado. Verifique sua conexão com a internet."
        );
      }

      const key = CONFIG.SUPABASE_ANON_KEY.trim();
      const configuredUrl = CONFIG.SUPABASE_URL.trim();

      if (!key || key === "COLE_SUA_ANON_PUBLIC_AQUI") {
        showSetupStatus(
          "Configure sua chave do Supabase",
          "Abra app.js e cole sua chave anon/public em CONFIG.SUPABASE_ANON_KEY. O mapa-base continuará disponível enquanto a conexão não estiver configurada."
        );
        return;
      }

      const supabaseUrl = configuredUrl || inferSupabaseUrlFromJwt(key);

      if (!supabaseUrl) {
        showSetupStatus(
          "Informe também a URL do projeto",
          "Sua chave não contém o identificador do projeto. Preencha CONFIG.SUPABASE_URL com algo como https://seu-projeto.supabase.co."
        );
        return;
      }

      state.supabaseClient = window.supabase.createClient(supabaseUrl, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });

      try {
        await syncAuthSession();
      } catch (authError) {
        console.warn("[Mapa de clientes] Sessao de manutencao indisponivel:", authError);
        renderMaintenanceSession();
      }
      startAuthListener();

      const rawRows = await fetchAllRows();
      const normalized = rawRows
        .map(normalizeClient)
        .filter(Boolean);

      state.clients = normalized;
      buildCoordinateCounts();
      applyVisualSpread();
      buildMarkers();
      populateFilterOptions();
      restoreFilterControls();
      refreshMunicipioOptions();
      applyFilters({ fit: true });

      const validCoordinates = state.clients.filter((client) => client.hasValidCoordinates).length;
      const invalidCoordinates = state.clients.length - validCoordinates;

      dom.dataCaption.textContent =
        invalidCoordinates > 0
          ? `${formatNumber(state.clients.length)} registros • ${formatNumber(invalidCoordinates)} sem coordenada`
          : `${formatNumber(state.clients.length)} registros carregados`;

      hideStatus();

      if (invalidCoordinates > 0) {
        showToast(
          `${formatNumber(invalidCoordinates)} registro(s) sem coordenadas válidas não aparecem no mapa.`
        );
      }
    } catch (error) {
      console.error("[Mapa de clientes] Falha ao carregar:", error);
      showErrorStatus(
        "Não foi possível carregar os clientes",
        friendlySupabaseError(error)
      );
    } finally {
      state.loading = false;
    }
  }

  async function fetchAllRows() {
    const rows = [];
    let from = 0;
    let page = 0;

    while (true) {
      page += 1;

      const query = state.supabaseClient
        .schema(CONFIG.SCHEMA_NAME)
        .from(CONFIG.TABLE_NAME)
        .select("*")
        .order("cliente_id", { ascending: true })
        .range(from, from + CONFIG.PAGE_SIZE - 1);

      const { data, error } = await query;

      if (error) throw error;
      if (!Array.isArray(data) || data.length === 0) break;

      rows.push(...data);
      from += data.length;

      if (page >= 50) {
        throw new Error(
          "A leitura foi interrompida por segurança após 50 páginas. Reduza PAGE_SIZE ou revise a consulta."
        );
      }
    }

    return rows;
  }

  function normalizeClient(raw, index) {
    if (!raw || typeof raw !== "object") return null;

    const latitude = toNumber(
      raw.latitude_efetiva ?? raw.latitude_confirmada ?? raw.latitude
    );
    const longitude = toNumber(
      raw.longitude_efetiva ?? raw.longitude_confirmada ?? raw.longitude
    );
    const cnpj = cleanValue(raw.cnpj);
    const seq = cleanValue(raw.seq);
    const id = cleanValue(raw.cliente_id) || cnpj || `${seq || "registro"}-${index}`;

    const razaoSocial = cleanValue(raw.razao_social);
    const nomeFantasia = cleanOptionalValue(raw.nome_fantasia);
    const situacao =
      cleanValue(raw.situacao_cadastral) ||
      cleanValue(raw.situacao) ||
      "";
    const uf = cleanValue(raw.uf)?.toUpperCase() || "";
    const municipio = cleanValue(raw.municipio) || "";
    const logradouro = cleanOptionalValue(raw.logradouro);
    const bairro = cleanValue(raw.bairro);
    const cep = cleanValue(raw.cep);
    const telefone = sanitizePhone(raw.telefone);
    const telefone1 = sanitizePhone(raw.telefone_1);
    const whatsapp = sanitizePhone(raw.whatsapp);
    const email = cleanOptionalValue(raw.email)?.toLowerCase() || "";
    const contatoNome = cleanOptionalValue(raw.contato_nome);
    const cnae = cleanValue(raw.cnae);
    const geocodeStatus =
      cleanValue(raw.precisao_efetiva || raw.localizacao_status || raw.geocode_status)
        ?.toUpperCase() || "SEM_STATUS";
    const origemRegistro = cleanValue(raw.origem_registro).toUpperCase();
    const revisao = Number(raw.revisao || 1);
    const classificacaoRegistro =
      cleanValue(raw.classificacao_registro).toUpperCase() ||
      (origemRegistro === "CADASTRO_CAMPO"
        ? "NOVO"
        : revisao > 1
          ? "ATUALIZADO"
          : "BASE_ORIGINAL");

    const hasValidCoordinates =
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      latitude >= BRAZIL_BOUNDS[0][0] &&
      latitude <= BRAZIL_BOUNDS[1][0] &&
      longitude >= BRAZIL_BOUNDS[0][1] &&
      longitude <= BRAZIL_BOUNDS[1][1];

    const displayName = nomeFantasia || razaoSocial || cnpj || "Cliente";
    const subtitle =
      nomeFantasia && razaoSocial && nomeFantasia !== razaoSocial
        ? razaoSocial
        : [municipio, uf].filter(Boolean).join(" - ");

    const coordinateKey = hasValidCoordinates
      ? `${latitude.toFixed(6)},${longitude.toFixed(6)}`
      : "";

    const searchable = normalizeSearchText(
      [
        displayName,
        razaoSocial,
        nomeFantasia,
        cnpj,
        uf,
        municipio,
        bairro,
        cep,
        logradouro,
        cnae,
        situacao,
        telefone,
        telefone1,
        whatsapp,
        email,
        contatoNome
      ]
        .filter(Boolean)
        .join(" ")
    );

    return {
      id,
      cnpj,
      seq,
      razaoSocial,
      nomeFantasia,
      displayName,
      subtitle,
      situacao,
      uf,
      municipio,
      logradouro,
      bairro,
      cep,
      telefone,
      telefone1,
      whatsapp,
      email,
      contatoNome,
      cnae,
      origemRegistro,
      revisao,
      classificacaoRegistro,
      latitude,
      longitude,
      visualLatitude: latitude,
      visualLongitude: longitude,
      visualOffsetMeters: 0,
      visualGroupSize: 1,
      hasVisualOffset: false,
      geocodeStatus,
      coordinateKey,
      hasValidCoordinates,
      searchable,
      raw
    };
  }

  function buildCoordinateCounts() {
    state.coordinateCounts.clear();

    for (const client of state.clients) {
      if (!client.coordinateKey) continue;
      state.coordinateCounts.set(
        client.coordinateKey,
        (state.coordinateCounts.get(client.coordinateKey) || 0) + 1
      );
    }
  }

  function getRecordClassificationLabel(client) {
    if (client?.classificacaoRegistro === "NOVO") return "Novo cadastro";
    if (client?.classificacaoRegistro === "ATUALIZADO") return "Atualizado em campo";
    return "Base original";
  }

  function applyVisualSpread() {
    const groups = new Map();

    for (const client of state.clients) {
      client.visualLatitude = client.latitude;
      client.visualLongitude = client.longitude;
      client.visualOffsetMeters = 0;
      client.visualGroupSize = 1;
      client.hasVisualOffset = false;

      if (!client.coordinateKey) continue;
      const group = groups.get(client.coordinateKey) || [];
      group.push(client);
      groups.set(client.coordinateKey, group);
    }

    for (const group of groups.values()) {
      if (group.length < VISUAL_SPREAD.MIN_GROUP_SIZE) continue;

      group.sort((a, b) =>
        String(a.id).localeCompare(String(b.id), "pt-BR", {
          sensitivity: "base",
          numeric: true
        })
      );

      group.forEach((client, index) => {
        client.visualGroupSize = group.length;

        if (index === 0) return;

        const visualPoint = getSpiralVisualPoint(
          client.latitude,
          client.longitude,
          index,
          group.length
        );

        client.visualLatitude = visualPoint.lat;
        client.visualLongitude = visualPoint.lng;
        client.visualOffsetMeters = Math.round(visualPoint.radiusMeters);
        client.hasVisualOffset = true;
      });
    }
  }

  function getSpiralVisualPoint(latitude, longitude, index, groupSize) {
    const densityBoost = groupSize >= 80 ? 1.18 : groupSize >= 35 ? 1.08 : 1;
    const radiusMeters = Math.min(
      VISUAL_SPREAD.MAX_RADIUS_METERS,
      Math.sqrt(index) * VISUAL_SPREAD.STEP_METERS * densityBoost
    );
    const angle =
      (index * VISUAL_SPREAD.GOLDEN_ANGLE_DEGREES * Math.PI) / 180;
    const latOffset = (Math.cos(angle) * radiusMeters) / 111320;
    const lngMetersPerDegree =
      111320 * Math.max(0.25, Math.cos((latitude * Math.PI) / 180));
    const lngOffset = (Math.sin(angle) * radiusMeters) / lngMetersPerDegree;

    const lat = clamp(
      latitude + latOffset,
      BRAZIL_BOUNDS[0][0],
      BRAZIL_BOUNDS[1][0]
    );
    const lng = clamp(
      longitude + lngOffset,
      BRAZIL_BOUNDS[0][1],
      BRAZIL_BOUNDS[1][1]
    );

    return { lat, lng, radiusMeters };
  }

  function buildMarkers() {
    state.markerById.clear();
    const markerSize = isMobileViewport() ? 18 : 24;
    const markerAnchor = markerSize / 2;

    for (const client of state.clients) {
      if (!client.hasValidCoordinates) continue;

      const statusClass = [
        normalizeSearchText(client.situacao) === "ativa" ? "" : "is-inactive",
        client.classificacaoRegistro === "NOVO"
          ? "is-new"
          : client.classificacaoRegistro === "ATUALIZADO"
            ? "is-updated"
            : ""
      ].filter(Boolean).join(" ");
      const markerRecordLabel = getRecordClassificationLabel(client);

      const icon = L.divIcon({
        className: "client-marker-icon",
        html: `<div class="client-marker ${statusClass}" aria-hidden="true"></div>`,
        iconSize: [markerSize, markerSize],
        iconAnchor: [markerAnchor, markerAnchor]
      });

      const marker = L.marker([client.visualLatitude, client.visualLongitude], {
        icon,
        keyboard: true,
        riseOnHover: true,
        draggable: true,
        ...getMarkerAutoPanOptions(),
        title: `${client.displayName} - ${markerRecordLabel}`
      });

      marker.client = client;
      marker.on("click", (event) => handleMarkerClick(client, event));
      marker.on("dragstart", handleMarkerDragStart);
      marker.on("drag", handleMarkerDrag);
      marker.on("dragend", handleMarkerDragEnd);
      marker.on("add", syncMarkerDragState);
      state.markerById.set(client.id, marker);
    }

    syncMarkerDragState();
  }

  function syncMarkerDragState() {
    const draggable = canManageClients() && !state.pendingRelocation;

    for (const marker of state.markerById.values()) {
      if (!marker?.dragging) continue;
      if (draggable) {
        marker.dragging.enable();
      } else {
        marker.dragging.disable();
      }
      marker.getElement()?.classList.toggle("is-draggable", draggable);
    }
  }

  function handleMarkerDragStart(event) {
    if (!canManageClients() || state.pendingRelocation) return;

    const marker = event.target;
    marker.__mhsOriginalLatLng = marker.getLatLng();
    Object.assign(marker.options, getMarkerAutoPanOptions());
    showRelocationPreview(marker);
  }

  function handleMarkerDrag(event) {
    const marker = event.target;
    if (marker !== state.relocationPreviewSourceMarker) return;
    state.relocationPreviewMarker?.setLatLng(marker.getLatLng());
  }

  function handleMarkerDragEnd(event) {
    const marker = event.target;
    const client = marker?.client;
    const originalLatLng = marker?.__mhsOriginalLatLng;
    const nextLatLng = marker?.getLatLng();
    delete marker?.__mhsOriginalLatLng;

    if (!canManageClients() || !client || !originalLatLng || !nextLatLng) {
      return;
    }

    const unchanged =
      Math.abs(originalLatLng.lat - nextLatLng.lat) < 0.0000001 &&
      Math.abs(originalLatLng.lng - nextLatLng.lng) < 0.0000001;
    if (unchanged) {
      clearRelocationPreview(marker);
      return;
    }

    if (!isPointInBrazil(nextLatLng.lat, nextLatLng.lng)) {
      marker.setLatLng(originalLatLng);
      clearRelocationPreview(marker);
      showToast("O ponto deve permanecer dentro do Brasil.");
      return;
    }

    state.pendingRelocation = {
      marker,
      client,
      originalLatLng,
      nextLatLng,
      lookupStatus: "loading",
      lookupMessage: "",
      addressSuggestion: null
    };
    showRelocationConfirmation();
    syncMarkerDragState();
    void resolvePendingRelocationAddress(state.pendingRelocation);
  }

  function showRelocationConfirmation() {
    const pending = state.pendingRelocation;
    if (!pending) return;

    dom.relocationClientName.textContent = pending.client.displayName;
    dom.relocationCoordinates.textContent = `${pending.nextLatLng.lat.toFixed(7)}, ${pending.nextLatLng.lng.toFixed(7)}`;
    dom.relocationLocationSummary.textContent = formatRelocationLocationSummary(pending);
    dom.relocationConfirm.disabled = pending.lookupStatus === "loading";
    dom.relocationConfirm.textContent = pending.lookupStatus === "loading"
      ? "Consultando endereco..."
      : "Sim, reposicionar";
    dom.relocationCancel.disabled = false;
    dom.relocationConfirmation.classList.remove("is-hidden");
    if (pending.lookupStatus !== "loading") {
      window.setTimeout(() => dom.relocationConfirm.focus(), 0);
    }
  }

  function hideRelocationConfirmation() {
    dom.relocationConfirmation.classList.add("is-hidden");
    dom.relocationConfirm.disabled = false;
    dom.relocationConfirm.textContent = "Sim, reposicionar";
    dom.relocationLocationSummary.textContent = "";
    dom.relocationCancel.disabled = false;
  }

  function cancelPendingRelocation() {
    const pending = state.pendingRelocation;
    if (!pending) return;

    pending.marker.setLatLng(pending.originalLatLng);
    state.pendingRelocation = null;
    clearRelocationPreview(pending.marker);
    hideRelocationConfirmation();
    syncMarkerDragState();
    showToast("Reposicionamento descartado. O ponto voltou ao local anterior.");
  }

  async function confirmPendingRelocation() {
    const pending = state.pendingRelocation;
    if (!pending || !state.supabaseClient) return;

    dom.relocationConfirm.disabled = true;
    dom.relocationCancel.disabled = true;
    dom.relocationConfirm.textContent = "Salvando...";

    try {
      const { data, error } = await state.supabaseClient
        .schema(CONFIG.SCHEMA_NAME)
        .rpc("confirmar_localizacao", {
          p_cliente_id: pending.client.id,
          p_latitude: Number(pending.nextLatLng.lat.toFixed(7)),
          p_longitude: Number(pending.nextLatLng.lng.toFixed(7)),
          p_fonte: "ARRASTE_MANUAL_MAPA",
          p_precisao_m: null,
          p_observacao: "Ponto reposicionado por arraste e confirmado na interface de manutencao."
        });

      if (error) throw error;
      const savedId = cleanValue(data?.[0]?.cliente_id) || pending.client.id;
      state.pendingRelocation = null;
      clearRelocationPreview(pending.marker);
      hideRelocationConfirmation();
      syncMarkerDragState();

      await reloadClientsData();
      await loadMaintenanceActivity();
      const savedClient = getClientById(savedId);
      if (savedClient) openClient(savedClient, { focusMap: true });
      showToast("Nova localizacao confirmada e salva.");
    } catch (error) {
      console.error("[Mapa de clientes] Falha ao reposicionar por arraste:", error);
      dom.relocationCoordinates.textContent = friendlyMutationError(error);
      dom.relocationConfirm.disabled = false;
      dom.relocationCancel.disabled = false;
      dom.relocationConfirm.textContent = "Tentar novamente";
    }
  }

  async function resolvePendingRelocationAddress(pending) {
    if (!pending) return;

    try {
      const suggestion = await reverseGeocodeLocation({
        latitude: pending.nextLatLng.lat,
        longitude: pending.nextLatLng.lng
      });
      if (state.pendingRelocation !== pending) return;

      pending.lookupStatus = suggestion ? "resolved" : "unavailable";
      pending.addressSuggestion = suggestion || null;
      pending.lookupMessage = suggestion
        ? ""
        : "Endereco deste novo ponto nao localizado automaticamente.";
    } catch (error) {
      console.warn("[Mapa de clientes] Falha ao consultar endereco do reposicionamento:", error);
      if (state.pendingRelocation !== pending) return;

      pending.lookupStatus = "unavailable";
      pending.addressSuggestion = null;
      pending.lookupMessage = friendlyReverseGeocodeError(error);
    }

    showRelocationConfirmation();
  }

  function formatRelocationLocationSummary(pending) {
    if (pending.lookupStatus === "loading") {
      return "Consultando rua, endereco e CEP do novo ponto...";
    }

    const address = pending.addressSuggestion?.address;
    if (!address) {
      return pending.lookupMessage || "Endereco do novo ponto nao localizado automaticamente.";
    }

    const regionalAddress = [
      cleanValue(address.bairro),
      cleanValue(address.municipio),
      cleanValue(address.uf).toUpperCase()
    ].filter(Boolean).join(" · ");
    const lines = [
      cleanValue(address.logradouro) ? `Rua: ${cleanValue(address.logradouro)}` : "",
      regionalAddress ? `Endereco: ${regionalAddress}` : "",
      cleanValue(address.cep) ? `CEP: ${cleanValue(address.cep)}` : ""
    ].filter(Boolean);

    if (cleanValue(pending.addressSuggestion?.attribution)) {
      lines.push(cleanValue(pending.addressSuggestion.attribution));
    }

    return lines.join("\n") || cleanValue(pending.addressSuggestion?.formattedAddress) ||
      "Endereco do novo ponto nao localizado automaticamente.";
  }

  function showRelocationPreview(marker) {
    if (!marker || !state.relocationPreviewLayer || !window.L) return;

    clearRelocationPreview();
    state.relocationPreviewSourceMarker = marker;
    marker.getElement()?.classList.add("is-relocation-source");
    state.relocationPreviewMarker = L.marker(marker.getLatLng(), {
      icon: createRelocationPinIcon(marker.client?.id),
      interactive: false,
      keyboard: false,
      zIndexOffset: 1600
    }).addTo(state.relocationPreviewLayer);
    dom.app.classList.add("is-repositioning-client");
  }

  function clearRelocationPreview(marker = state.relocationPreviewSourceMarker) {
    marker?.getElement()?.classList.remove("is-relocation-source");
    state.relocationPreviewLayer?.clearLayers();
    state.relocationPreviewMarker = null;
    state.relocationPreviewSourceMarker = null;
    if (!state.pendingRelocation) {
      dom.app.classList.remove("is-repositioning-client");
    }
  }

  function createRelocationPinIcon(clientId) {
    const suffix = cleanValue(clientId).replace(/[^a-z0-9_-]/gi, "") || "cliente";
    const gradientId = `relocation-pin-fill-${suffix}`;

    return L.divIcon({
      className: "relocation-marker-icon",
      html: `<div class="relocation-marker" aria-hidden="true">
        <svg class="relocation-marker-svg" viewBox="0 0 64 76" focusable="false">
          <defs>
            <linearGradient id="${gradientId}" x1="15" y1="8" x2="52" y2="66" gradientUnits="userSpaceOnUse">
              <stop stop-color="#69d888"></stop>
              <stop offset="0.5" stop-color="#34c759"></stop>
              <stop offset="1" stop-color="#188b37"></stop>
            </linearGradient>
          </defs>
          <path fill="url(#${gradientId})" d="M32 3C16.7 3 8 14.1 8 28.4c0 17.8 19.5 39.3 22.2 42.3a2.45 2.45 0 0 0 3.6 0C36.5 67.7 56 46.2 56 28.4 56 14.1 47.3 3 32 3Z"></path>
          <circle cx="32" cy="28" r="12.5" fill="rgba(255,255,255,0.96)"></circle>
          <circle cx="32" cy="28" r="5.6" fill="none" stroke="#209a43" stroke-width="2.5"></circle>
          <path d="M32 18.6v4M32 33.4v4M22.6 28h4M37.4 28h4" fill="none" stroke="#209a43" stroke-width="2.5" stroke-linecap="round"></path>
          <path d="M18.8 14.2C22.2 10.3 26.7 8 32 8" fill="none" stroke="rgba(255,255,255,0.34)" stroke-width="2.2" stroke-linecap="round"></path>
        </svg>
        <span class="relocation-marker-label">Reposicionando</span>
      </div>`,
      iconSize: [64, 76],
      iconAnchor: [32, 71]
    });
  }

  function handleMarkerClick(client, event) {
    if (state.pendingRelocation) return;
    if (state.locationPickerActive) {
      handleLocationPickerClick(event);
      return;
    }

    setRegionTarget(
      event?.latlng || L.latLng(client.visualLatitude, client.visualLongitude),
      getClickRegionSource()
    );
    updateRegionReadout();

    const group = getCoordinateGroup(client);

    if (shouldOpenIndividualClient(group)) {
      openClient(client, { focusMap: false });
      return;
    }

    const latlng =
      event?.latlng || L.latLng(client.visualLatitude, client.visualLongitude);
    showPointChoice(group, latlng);
  }

  function shouldOpenIndividualClient(group) {
    if (!state.map || group.length <= 1) return true;
    return state.map.getZoom() >= getIndividualClientZoom();
  }

  function getIndividualClientZoom() {
    return isMobileViewport()
      ? POINT_NAVIGATION.MOBILE_INDIVIDUAL_ZOOM
      : POINT_NAVIGATION.DESKTOP_INDIVIDUAL_ZOOM;
  }

  function getCoordinateGroup(client) {
    if (!client) return [];
    if (!client.coordinateKey) return [client];

    return state.clients.filter(
      (item) => item.coordinateKey === client.coordinateKey
    );
  }

  function uniqueClientsById(clients) {
    const seen = new Set();
    const unique = [];

    for (const client of clients) {
      if (!client?.id || seen.has(client.id)) continue;
      seen.add(client.id);
      unique.push(client);
    }

    return unique;
  }

  function handleClusterClick(event) {
    const cluster = event.layer;
    if (!cluster || typeof cluster.getAllChildMarkers !== "function") return;

    const markers = cluster.getAllChildMarkers();
    const clients = markers.map((marker) => marker.client).filter(Boolean);
    if (!clients.length) return;

    const coordinateKeys = new Set(clients.map((client) => client.coordinateKey));
    const samePoint = coordinateKeys.size === 1;

    if (samePoint) {
      if (event.originalEvent) L.DomEvent.stop(event.originalEvent);
      const latlng = cluster.getLatLng?.() || cluster.getBounds().getCenter();
      setRegionTarget(latlng, getClickRegionSource());
      updateRegionReadout();
      showPointChoice(clients, latlng);
      return;
    }

    if (state.map.getZoom() >= state.map.getMaxZoom() - 1) {
      if (event.originalEvent) L.DomEvent.stop(event.originalEvent);
      setRegionTarget(cluster.getLatLng?.() || cluster.getBounds().getCenter(), getClickRegionSource());
      updateRegionReadout();
      openClient(clients[0], { focusMap: true });
      showToast(`${formatNumber(clients.length)} cliente(s) neste ponto. Veja as pre-visualizacoes na ficha.`);
      return;
    }

    const bounds = cluster.getBounds();
    if (bounds?.isValid?.()) {
      state.map.fitBounds(bounds, {
        paddingTopLeft: [28, 170],
        paddingBottomRight: [28, 44],
        maxZoom: 14,
        animate: !prefersReducedMotion(),
        duration: 0.42
      });
    }
  }

  function showPointChoice(clients, latlng) {
    if (!state.map || !clients.length) return;

    const group = uniqueClientsById(clients).filter(
      (client) => client.hasValidCoordinates
    );
    if (!group.length) return;

    if (group.length === 1) {
      openClient(group[0], { focusMap: false });
      return;
    }

    const content = document.createElement("div");
    content.className = "point-choice";

    if (window.L?.DomEvent) {
      L.DomEvent.disableClickPropagation(content);
      L.DomEvent.disableScrollPropagation(content);
    }

    const eyebrow = document.createElement("span");
    eyebrow.className = "point-choice-eyebrow";
    eyebrow.textContent = `${formatNumber(group.length)} clientes neste ponto`;

    const title = document.createElement("strong");
    title.textContent = "O que voce quer ver?";

    const actions = document.createElement("div");
    actions.className = "point-choice-actions";

    const listButton = document.createElement("button");
    listButton.type = "button";
    listButton.className = "point-choice-button is-primary";
    listButton.textContent = "Ver lista completa";
    listButton.addEventListener("click", () => {
      state.map.closePopup();
      openClient(group[0], { focusMap: false, listMode: true });
    });

    const pointsButton = document.createElement("button");
    pointsButton.type = "button";
    pointsButton.className = "point-choice-button";
    pointsButton.textContent = "Ver todos os pontos";
    pointsButton.addEventListener("click", () => {
      state.map.closePopup();
      focusCoordinateGroup(group);
    });

    actions.append(listButton, pointsButton);
    content.append(eyebrow, title, actions);

    L.popup({
      className: "point-choice-popup",
      closeButton: false,
      autoPan: true,
      autoClose: true,
      closeOnClick: true,
      maxWidth: 300,
      offset: [0, -10]
    })
      .setLatLng(latlng)
      .setContent(content)
      .openOn(state.map);
  }

  function focusCoordinateGroup(clients) {
    if (!state.map) return;

    const points = uniqueClientsById(clients)
      .filter((client) => client.hasValidCoordinates)
      .map((client) => [client.visualLatitude, client.visualLongitude]);

    if (!points.length) return;

    clearClientSearchFocusForPointGroup();

    if (state.viewMode !== "markers") {
      setViewMode("markers");
    }

    state.selectedLayer?.clearLayers();

    if (points.length === 1) {
      state.map.flyTo(points[0], getIndividualClientZoom(), {
        duration: prefersReducedMotion() ? 0 : 0.45
      });
      return;
    }

    const bounds = L.latLngBounds(points);
    const targetZoom = getIndividualClientZoom();

    state.map.fitBounds(bounds, {
      paddingTopLeft: [32, 150],
      paddingBottomRight: [32, 52],
      maxZoom: targetZoom,
      animate: !prefersReducedMotion(),
      duration: 0.45
    });

    showToast(`${formatNumber(points.length)} pontos separados para escolha.`);
  }

  function clearClientSearchFocusForPointGroup() {
    const searchIntent = getSearchIntent(normalizeSearchText(state.searchQuery));
    if (!state.searchFocusClientId && searchIntent?.type !== "client") return;

    state.searchQuery = "";
    state.searchFocusClientId = "";
    state.searchResultIndex = -1;
    state.lastSearchFitKey = "";
    dom.searchInput.value = "";
    dom.clearSearch.classList.add("is-hidden");
    hideSearchResults();
    applyFilters({ fit: false });
  }

  function populateFilterOptions() {
    const ufs = uniqueSorted(
      state.clients.map((client) => client.uf).filter(Boolean)
    );
    const situacoes = uniqueSorted(
      state.clients.map((client) => client.situacao).filter(Boolean)
    );

    setSelectOptions(dom.filterUf, ufs, "Todos os estados", state.filters.uf);
    setSelectOptions(
      dom.filterSituacao,
      situacoes,
      "Todas as situações",
      state.filters.situacao
    );
  }

  function restoreFilterControls() {
    dom.filterUf.value = optionExists(dom.filterUf, state.filters.uf)
      ? state.filters.uf
      : "";
    state.filters.uf = dom.filterUf.value;

    dom.filterSituacao.value = optionExists(
      dom.filterSituacao,
      state.filters.situacao
    )
      ? state.filters.situacao
      : "";
    state.filters.situacao = dom.filterSituacao.value;
  }

  function refreshMunicipioOptions() {
    const municipios = uniqueSorted(
      state.clients
        .filter((client) => !state.filters.uf || client.uf === state.filters.uf)
        .map((client) => client.municipio)
        .filter(Boolean)
    );

    const preferred = state.filters.municipio;

    setSelectOptions(
      dom.filterMunicipio,
      municipios,
      "Todos os municípios",
      preferred
    );

    if (!optionExists(dom.filterMunicipio, preferred)) {
      state.filters.municipio = "";
      dom.filterMunicipio.value = "";
    }
  }

  function getSearchIntent(query) {
    const lookupQuery = normalizeLookupText(query);
    if (!lookupQuery) return null;

    if (state.searchIntentOverride) return state.searchIntentOverride;

    if (state.searchFocusClientId) {
      const client = state.clients.find((item) => item.id === state.searchFocusClientId);
      if (client) return { type: "client", client };
    }

    const digits = onlyDigits(query);
    if (digits.length >= 8) {
      const client = state.clients.find(
        (item) => onlyDigits(item.cnpj) === digits || onlyDigits(item.id) === digits
      );
      if (client) return { type: "client", client };
    }

    const exactClient = state.clients.find((client) =>
      [client.displayName, client.nomeFantasia, client.razaoSocial, client.cnpj]
        .filter(Boolean)
        .some((value) => normalizeLookupText(value) === lookupQuery)
    );
    if (exactClient) return { type: "client", client: exactClient };

    const stateUf =
      BRAZIL_STATE_ALIASES[lookupQuery] ||
      (lookupQuery.length === 2 ? lookupQuery.toUpperCase() : "");
    if (stateUf && state.clients.some((client) => client.uf === stateUf)) {
      return { type: "state", uf: stateUf };
    }

    const exactCityUfMatches = state.clients.filter(
      (client) =>
        client.municipio &&
        client.uf &&
        normalizeLookupText(`${client.municipio} ${client.uf}`) === lookupQuery
    );
    if (exactCityUfMatches.length) {
      const first = exactCityUfMatches[0];
      return {
        type: "city",
        city: normalizeLookupText(first.municipio),
        uf: first.uf
      };
    }

    const cityMatches = state.clients.filter(
      (client) => normalizeLookupText(client.municipio) === lookupQuery
    );
    if (cityMatches.length) {
      const ufs = uniqueSorted(cityMatches.map((client) => client.uf));
      return {
        type: "city",
        city: normalizeLookupText(cityMatches[0].municipio),
        uf: ufs.length === 1 ? ufs[0] : ""
      };
    }

    if (lookupQuery.length >= 3) {
      const districtMatches = state.clients.filter(
        (client) => normalizeLookupText(client.bairro) === lookupQuery
      );
      if (districtMatches.length) {
        const first = districtMatches[0];
        const cityKeys = uniqueSorted(
          districtMatches.map((client) =>
            normalizeLookupText(`${client.municipio} ${client.uf}`)
          )
        );
        return {
          type: "district",
          district: normalizeLookupText(first.bairro),
          city: cityKeys.length === 1 ? normalizeLookupText(first.municipio) : "",
          uf: cityKeys.length === 1 ? first.uf : ""
        };
      }
    }

    if (lookupQuery.length >= 5) {
      const streetMatches = state.clients.filter(
        (client) => normalizeLookupText(client.logradouro) === lookupQuery
      );
      if (streetMatches.length) {
        const first = streetMatches[0];
        const cityKeys = uniqueSorted(
          streetMatches.map((client) =>
            normalizeLookupText(`${client.municipio} ${client.uf}`)
          )
        );
        return {
          type: "street",
          street: normalizeLookupText(first.logradouro),
          district: cityKeys.length === 1 ? normalizeLookupText(first.bairro) : "",
          city: cityKeys.length === 1 ? normalizeLookupText(first.municipio) : "",
          uf: cityKeys.length === 1 ? first.uf : ""
        };
      }
    }

    return null;
  }

  function matchesSearchIntent(client, query, intent) {
    if (!intent) {
      const lookupQuery = normalizeLookupText(query);
      return (
        client.searchable.includes(query) ||
        normalizeLookupText(client.searchable).includes(lookupQuery)
      );
    }

    if (intent.type === "client") return client.id === intent.client.id;
    if (intent.type === "state") return client.uf === intent.uf;
    if (intent.type === "city") {
      return (
        normalizeLookupText(client.municipio) === intent.city &&
        (!intent.uf || client.uf === intent.uf)
      );
    }
    if (intent.type === "district") {
      return (
        normalizeLookupText(client.bairro) === intent.district &&
        (!intent.city || normalizeLookupText(client.municipio) === intent.city) &&
        (!intent.uf || client.uf === intent.uf)
      );
    }
    if (intent.type === "street") {
      return (
        normalizeLookupText(client.logradouro) === intent.street &&
        (!intent.district || normalizeLookupText(client.bairro) === intent.district) &&
        (!intent.city || normalizeLookupText(client.municipio) === intent.city) &&
        (!intent.uf || client.uf === intent.uf)
      );
    }

    return client.searchable.includes(query);
  }

  function getSearchIntentFitKey(intent) {
    if (!intent) return "";
    if (intent.type === "client") return `client:${intent.client.id}`;
    if (intent.type === "state") return `state:${intent.uf}`;
    if (intent.type === "city") return `city:${intent.uf || "*"}:${intent.city}`;
    if (intent.type === "district") {
      return `district:${intent.uf || "*"}:${intent.city || "*"}:${intent.district}`;
    }
    if (intent.type === "street") {
      return `street:${intent.uf || "*"}:${intent.city || "*"}:${intent.street}`;
    }
    return "";
  }

  function shouldAutoFitSearchQuery(query) {
    const intent = getSearchIntent(query);
    const fitKey = getSearchIntentFitKey(intent);

    if (!fitKey) {
      state.lastSearchFitKey = "";
      return false;
    }

    if (fitKey === state.lastSearchFitKey) return false;

    state.lastSearchFitKey = fitKey;
    return true;
  }

  function applyFilters({ fit = false } = {}) {
    const query = normalizeSearchText(state.searchQuery);
    const searchIntent = getSearchIntent(query);

    state.filteredClients = state.clients.filter((client) => {
      if (state.filters.uf && client.uf !== state.filters.uf) return false;
      if (
        state.filters.municipio &&
        client.municipio !== state.filters.municipio
      ) {
        return false;
      }
      if (
        state.filters.situacao &&
        client.situacao !== state.filters.situacao
      ) {
        return false;
      }
      if (state.areaSelection && !isClientInsideAreaSelection(client)) return false;
      if (query && !matchesSearchIntent(client, query, searchIntent)) return false;
      return true;
    });

    dom.resultCount.textContent = formatNumber(state.filteredClients.length);
    syncAreaSelectionUi();

    refreshMapLayers();

    if (state.searchQuery && document.activeElement === dom.searchInput) {
      renderSearchResults();
    }

    if (
      state.selectedClient &&
      !state.filteredClients.some(
        (client) => client.id === state.selectedClient.id
      )
    ) {
      closeClientPanel();
    }

    renderReport();
    updateRegionReadout();

    const territoryHandled = syncTerritoryLayer(searchIntent, { fit });

    if (fit && !territoryHandled) {
      fitFilteredClients(searchIntent);
    }
  }

  function syncTerritoryLayer(searchIntent, { fit = false } = {}) {
    if (!isTerritoryIntent(searchIntent)) {
      clearTerritoryLayer();
      return false;
    }

    loadAndRenderTerritory(searchIntent, { fit });
    return true;
  }

  function isTerritoryIntent(intent) {
    return Boolean(
      intent &&
      (intent.type === "state" || (intent.type === "city" && intent.uf))
    );
  }

  async function loadAndRenderTerritory(intent, { fit = false } = {}) {
    const key = getTerritoryKey(intent);
    if (!key) {
      clearTerritoryLayer();
      if (fit) fitFilteredClients(intent);
      return;
    }

    state.territoryRequestKey = key;

    try {
      const cached = state.territoryCache.get(key);
      const payload = cached || await fetchTerritoryGeoJson(intent);

      if (!payload || state.territoryRequestKey !== key) return;
      state.territoryCache.set(key, payload);
      renderTerritoryGeoJson(payload.geojson, payload.label, intent, { fit });
    } catch (error) {
      console.warn("[Mapa de clientes] Falha ao carregar limite territorial:", error);
      clearTerritoryLayer();
      if (fit) fitFilteredClients(intent);
      showToast("Limite territorial IBGE indisponivel agora. Usando pontos dos clientes.");
    }
  }

  async function fetchTerritoryGeoJson(intent) {
    if (intent.type === "state") {
      const code = IBGE_UF_CODES[intent.uf];
      if (!code) return null;

      return {
        label: formatStateLabel(intent.uf),
        geojson: await fetchJsonNoStore(buildIbgeMalhaUrl("estados", code))
      };
    }

    if (intent.type === "city") {
      const municipality = await findMunicipalityCatalogEntry(intent);
      if (!municipality?.id) return null;

      return {
        label: `${municipality.nome} - ${municipality.uf}`,
        geojson: await fetchJsonNoStore(buildIbgeMalhaUrl("municipios", municipality.id))
      };
    }

    return null;
  }

  function buildIbgeMalhaUrl(level, id) {
    const url = new URL(`${TERRITORY.MALHAS_URL}/${level}/${id}`);
    url.searchParams.set("formato", TERRITORY.GEOJSON_FORMAT);
    url.searchParams.set("qualidade", TERRITORY.QUALITY);
    return url.toString();
  }

  async function findMunicipalityCatalogEntry(intent) {
    const catalog = await getMunicipalityCatalog();
    const city = normalizeLookupText(intent.cityName || intent.city);
    const uf = cleanValue(intent.uf).toUpperCase();

    return catalog.find(
      (item) => item.uf === uf && normalizeLookupText(item.nome) === city
    ) || null;
  }

  async function getMunicipalityCatalog() {
    if (state.municipalityCatalog) return state.municipalityCatalog;

    const rows = await fetchJsonNoStore(`${TERRITORY.LOCALIDADES_URL}/municipios`);
    state.municipalityCatalog = rows.map((item) => ({
      id: item.id,
      nome: item.nome,
      uf: item.microrregiao?.mesorregiao?.UF?.sigla || ""
    }));

    return state.municipalityCatalog;
  }

  async function fetchJsonNoStore(url) {
    const response = await fetch(`${url}${url.includes("?") ? "&" : "?"}_=${Date.now()}`, {
      cache: "no-store",
      headers: {
        Accept: "application/vnd.geo+json, application/json",
        "Cache-Control": "no-cache",
        Pragma: "no-cache"
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
  }

  function renderTerritoryGeoJson(geojson, label, intent, { fit = false } = {}) {
    if (!state.territoryLayer || !geojson) return;

    state.territoryLayer.clearLayers();
    state.territoryLayer.addData(geojson);
    state.activeTerritoryKey = getTerritoryKey(intent);

    if (typeof state.territoryLayer.bringToBack === "function") {
      state.territoryLayer.bringToBack();
    }

    if (fit) {
      fitTerritoryLayer(intent);
    }

    if (label) {
      showToast(`Limite IBGE: ${label}`);
    }
  }

  function fitTerritoryLayer(intent) {
    if (!state.map || !state.territoryLayer) return;

    const bounds = state.territoryLayer.getBounds();
    if (!bounds?.isValid?.()) {
      fitFilteredClients(intent);
      return;
    }

    state.map.fitBounds(bounds, {
      paddingTopLeft: [34, 150],
      paddingBottomRight: [34, 48],
      maxZoom: intent.type === "state"
        ? TERRITORY.STATE_MAX_ZOOM
        : TERRITORY.CITY_MAX_ZOOM,
      animate: !prefersReducedMotion(),
      duration: 0.56
    });
  }

  function clearTerritoryLayer() {
    state.activeTerritoryKey = "";
    state.territoryRequestKey = "";
    state.territoryLayer?.clearLayers();
  }

  function getTerritoryKey(intent) {
    if (!intent) return "";
    if (intent.type === "state") return `state:${intent.uf}`;
    if (intent.type === "city" && intent.uf) {
      return `city:${intent.uf}:${intent.city || normalizeLookupText(intent.cityName)}`;
    }
    return "";
  }

  function getTerritoryStyle() {
    return {
      color: "#0069d9",
      weight: 2.4,
      opacity: 0.9,
      fillColor: "#007aff",
      fillOpacity: 0.08,
      dashArray: "7 6",
      lineCap: "round",
      lineJoin: "round"
    };
  }

  function selectVisibleMapArea() {
    if (!state.map) return;

    const bounds = state.map.getBounds();
    const mappable = state.clients.filter((client) =>
      client.hasValidCoordinates && bounds.contains([client.visualLatitude, client.visualLongitude])
    );

    if (!mappable.length) {
      showToast("A area visivel nao tem clientes com coordenadas.");
      return;
    }

    state.areaSelection = {
      bounds: serializeLatLngBounds(bounds),
      label: buildAreaSelectionLabel(bounds, mappable.length),
      createdAt: Date.now()
    };

    drawAreaSelection();
    applyFilters({ fit: false });
    showToast(`Area visivel aplicada: ${formatNumber(mappable.length)} cliente(s) no recorte.`);
  }

  function clearAreaSelection({ apply = false, silent = false } = {}) {
    state.areaSelection = null;
    drawAreaSelection();
    syncAreaSelectionUi();

    if (apply) {
      applyFilters({ fit: false });
      if (!silent) showToast("Recorte por area removido.");
    }
  }

  function fitAreaSelection() {
    if (!state.map || !state.areaSelection) return;

    const bounds = getAreaSelectionLatLngBounds();
    if (!bounds?.isValid?.()) return;

    state.map.fitBounds(bounds, {
      paddingTopLeft: [28, 150],
      paddingBottomRight: [28, 44],
      animate: !prefersReducedMotion(),
      duration: 0.45
    });
  }

  function syncAreaSelectionUi() {
    const active = Boolean(state.areaSelection);

    dom.reportFitArea.disabled = !active;
    dom.reportClearArea.disabled = !active;
    dom.reportExportArea.disabled = !active;
    dom.resultPill.classList.toggle("is-area-scoped", active);
    dom.resultPill.title = active
      ? "Clientes dentro da area visivel selecionada"
      : "";

    dom.reportScopeLabel.textContent = active
      ? "Area visivel selecionada"
      : getReportScopeLabel();
    dom.reportScopeNote.textContent = active
      ? state.areaSelection.label
      : getReportScopeNote();
  }

  function drawAreaSelection() {
    if (!state.areaLayer || !window.L) return;

    state.areaLayer.clearLayers();
    if (!state.areaSelection) return;

    const bounds = getAreaSelectionLatLngBounds();
    if (!bounds?.isValid?.()) return;

    L.rectangle(bounds, {
      interactive: false,
      className: "area-selection-shape",
      color: "#007aff",
      weight: 2,
      opacity: 0.92,
      fillColor: "#007aff",
      fillOpacity: 0.07,
      dashArray: "8 7",
      lineCap: "round",
      lineJoin: "round"
    }).addTo(state.areaLayer);
  }

  function serializeLatLngBounds(bounds) {
    const southWest = bounds.getSouthWest();
    const northEast = bounds.getNorthEast();

    return {
      south: southWest.lat,
      west: southWest.lng,
      north: northEast.lat,
      east: northEast.lng
    };
  }

  function getAreaSelectionLatLngBounds() {
    if (!state.areaSelection?.bounds || !window.L) return null;

    const bounds = state.areaSelection.bounds;
    return L.latLngBounds(
      [bounds.south, bounds.west],
      [bounds.north, bounds.east]
    );
  }

  function isClientInsideAreaSelection(client) {
    const bounds = getAreaSelectionLatLngBounds();
    if (!bounds || !client?.hasValidCoordinates) return false;
    return bounds.contains([client.visualLatitude, client.visualLongitude]);
  }

  function buildAreaSelectionLabel(bounds, count) {
    const center = bounds.getCenter();
    const zoom = state.map?.getZoom?.() || 0;
    const level = getRegionLevelLabel(zoom);

    return `${formatNumber(count)} cliente(s) no recorte - ${level} proximo a ${center.lat.toFixed(3)}, ${center.lng.toFixed(3)}`;
  }

  function refreshMapLayers() {
    const mappable = state.filteredClients.filter(
      (client) => client.hasValidCoordinates
    );

    const markers = mappable
      .map((client) => state.markerById.get(client.id))
      .filter(Boolean);

    state.markerLayer.clearLayers();
    if (markers.length) {
      state.markerLayer.addLayers(markers);
    }

    state.heatPoints = mappable.map((client) => [
      client.latitude,
      client.longitude,
      1
    ]);

    if (state.viewMode !== "heat") {
      stopHeatAnimation();
      state.heatLayer.setLatLngs(state.heatPoints);
    }

    applyViewMode({ persist: false });
  }

  function scheduleRegionReadoutUpdate() {
    clearTimeout(state.regionTimer);
    if (isTouchInteraction()) return;

    dom.regionReadout.classList.add("is-updating");

    state.regionTimer = window.setTimeout(() => {
      updateRegionReadout();
    }, isMobileViewport() ? 140 : 90);
  }

  function handleRegionPointerMove(event) {
    if (isMobileViewport()) return;
    setRegionTarget(event.latlng, "cursor");
    scheduleRegionReadoutUpdate();
  }

  function handleMapMotionStart() {
    if (!isTouchInteraction()) return;

    window.clearTimeout(state.mapMotionTimer);
    state.mapMotionTimer = null;
    dom.app.classList.add("is-map-moving");
  }

  function handleMapMotionEnd() {
    if (!isTouchInteraction()) {
      updateRegionReadout();
      return;
    }

    window.clearTimeout(state.mapMotionTimer);
    state.mapMotionTimer = window.setTimeout(() => {
      state.mapMotionTimer = null;
      dom.app.classList.remove("is-map-moving");
      updateRegionReadout();
    }, MAP_MOTION.TOUCH_SETTLE_MS);
  }

  function setRegionTarget(latlng, source = "center") {
    if (!latlng || !Number.isFinite(latlng.lat) || !Number.isFinite(latlng.lng)) return;

    state.regionTargetLatLng = L.latLng(latlng.lat, latlng.lng);
    state.regionTargetSource = source;
  }

  function getRegionTargetLatLng() {
    if (state.regionTargetLatLng) return state.regionTargetLatLng;
    return state.map?.getCenter?.() || null;
  }

  function getClickRegionSource() {
    return isMobileViewport() ? "touch" : "click";
  }

  function getRegionSourceLabel() {
    if (state.regionTargetSource === "cursor") return "Cursor";
    if (state.regionTargetSource === "touch") return "Ultimo toque";
    if (state.regionTargetSource === "click") return "Clique";
    return "Centro do mapa";
  }

  function updateRegionReadout() {
    if (!state.map || !dom.regionReadout) return;

    clearTimeout(state.regionTimer);
    dom.regionReadout.classList.remove("is-updating");

    const targetLatLng = getRegionTargetLatLng();
    const regionClients = getRegionReferenceClients();
    const zoom = state.map.getZoom();
    const sourceLabel = getRegionSourceLabel();

    if (!state.clients.length) {
      setRegionReadout({
        level: "Mapa",
        title: "Brasil",
        subtitle: "Carregando leitura da base de clientes..."
      });
      return;
    }

    if (!regionClients.length || !targetLatLng) {
      setRegionReadout({
        level: getRegionLevelLabel(zoom),
        title: "Sem referencia na base",
        subtitle: `${sourceLabel} - ajuste os filtros ou aproxime do mapa`
      });
      return;
    }

    const level = getRegionLevel(zoom);
    const context = buildRegionContext(level, regionClients, targetLatLng);

    setRegionReadout({
      level: context.levelLabel,
      title: context.title,
      subtitle: `${sourceLabel} - ${context.subtitle}`
    });
  }

  function setRegionReadout({ level, title, subtitle }) {
    dom.regionLevel.textContent = level;
    dom.regionTitle.textContent = title;
    dom.regionSubtitle.textContent = subtitle;
  }

  function getRegionReferenceClients() {
    return state.filteredClients.filter(
      (client) => client.hasValidCoordinates
    );
  }

  function getRegionLevel(zoom) {
    if (zoom < 6) return "state";
    if (zoom < 10) return "city";
    if (zoom < 14) return "district";
    return "street";
  }

  function getRegionLevelLabel(zoom) {
    const level = getRegionLevel(zoom);
    if (level === "state") return "Estado";
    if (level === "city") return "Cidade";
    if (level === "district") return "Bairro";
    return "Rua";
  }

  function buildRegionContext(level, clients, targetLatLng) {
    if (level === "state") {
      const client = getNearestRegionClient(clients, null, targetLatLng);
      const title = formatStateLabel(client?.uf) || "Brasil";
      const count = clients.filter((item) => item.uf === client?.uf).length;

      return {
        levelLabel: "Estado",
        title,
        subtitle: `${formatNumber(count || clients.length)} cliente(s) no estado - ${formatRegionReference(client, targetLatLng)}`
      };
    }

    if (level === "city") {
      const client = getNearestRegionClient(clients, null, targetLatLng);
      const title =
        [client?.municipio, client?.uf].filter(Boolean).join(" - ") ||
        "Cidade nao informada";
      const count = clients.filter(
        (item) => item.municipio === client?.municipio && item.uf === client?.uf
      ).length;

      return {
        levelLabel: "Cidade",
        title,
        subtitle: `${formatNumber(count || clients.length)} cliente(s) na cidade - ${formatRegionReference(client, targetLatLng)}`
      };
    }

    if (level === "district") {
      const client =
        getNearestRegionClient(clients, (item) => cleanValue(item.bairro), targetLatLng) ||
        getNearestRegionClient(clients, null, targetLatLng);
      const title =
        cleanValue(client?.bairro) ||
        [client?.municipio, client?.uf].filter(Boolean).join(" - ") ||
        "Bairro nao informado";
      const subtitle = [client?.municipio, client?.uf]
        .filter(Boolean)
        .join(" - ");

      return {
        levelLabel: "Bairro",
        title,
        subtitle: [subtitle || "Area proxima", formatRegionReference(client, targetLatLng)]
          .filter(Boolean)
          .join(" - ")
      };
    }

    const nearestStreet = getNearestRegionClient(
      clients,
      (client) => cleanValue(client.logradouro),
      targetLatLng
    );
    const fallback = getNearestRegionClient(clients, null, targetLatLng);
    const client = nearestStreet || fallback;
    const title =
      cleanValue(client?.logradouro) ||
      cleanValue(client?.bairro) ||
      [client?.municipio, client?.uf].filter(Boolean).join(" - ") ||
      "Rua nao informada";
    const subtitle = [
      cleanValue(client?.bairro),
      [client?.municipio, client?.uf].filter(Boolean).join(" - ")
    ].filter(Boolean).join(" - ");

    return {
      levelLabel: "Rua",
      title,
      subtitle: [subtitle || "Cliente mais proximo", formatRegionReference(client, targetLatLng)]
        .filter(Boolean)
        .join(" - ")
    };
  }

  function getNearestRegionClient(clients, predicate, targetLatLng = null) {
    if (!state.map || !clients.length) return null;

    const anchor = targetLatLng || state.map.getCenter();
    let nearest = null;
    let nearestDistance = Infinity;

    for (const client of clients) {
      if (predicate && !predicate(client)) continue;

      const distance = state.map.distance(
        anchor,
        [client.visualLatitude, client.visualLongitude]
      );

      if (distance < nearestDistance) {
        nearest = client;
        nearestDistance = distance;
      }
    }

    return nearest;
  }

  function formatRegionReference(client, targetLatLng) {
    if (!state.map || !client || !targetLatLng) return "";

    const distance = state.map.distance(
      targetLatLng,
      [client.visualLatitude, client.visualLongitude]
    );

    if (distance <= 120) return "no ponto indicado";
    return `ref. mais proxima a ${formatCompactDistance(distance)}`;
  }

  function setViewMode(mode) {
    if (mode !== "markers" && mode !== "heat") return;
    state.viewMode = mode;
    syncViewButtons();
    applyViewMode({ persist: true });
  }

  function applyViewMode({ persist = false } = {}) {
    if (!state.map || !state.markerLayer || !state.heatLayer) return;

    if (state.viewMode === "heat") {
      dom.map.classList.add("is-heat-mode");
      if (state.map.hasLayer(state.markerLayer)) {
        state.map.removeLayer(state.markerLayer);
      }
      if (!state.map.hasLayer(state.heatLayer)) {
        state.heatLayer.addTo(state.map);
      }
      refreshHeatLayer({ animate: true });
    } else {
      dom.map.classList.remove("is-heat-mode", "is-heat-animating");
      stopHeatAnimation();
      if (state.map.hasLayer(state.heatLayer)) {
        state.map.removeLayer(state.heatLayer);
      }
      if (!state.map.hasLayer(state.markerLayer)) {
        state.markerLayer.addTo(state.map);
      }
    }

    if (persist) persistUiState();
  }

  function syncViewButtons() {
    const markerActive = state.viewMode === "markers";

    dom.viewMarkers.classList.toggle("is-active", markerActive);
    dom.viewHeat.classList.toggle("is-active", !markerActive);

    dom.viewMarkers.setAttribute("aria-pressed", String(markerActive));
    dom.viewHeat.setAttribute("aria-pressed", String(!markerActive));
  }

  function getHeatOptions() {
    return isMobileViewport() ? HEAT_STYLE.MOBILE : HEAT_STYLE.DESKTOP;
  }

  function refreshHeatLayer({ animate = false } = {}) {
    if (!state.heatLayer?.setLatLngs) return;

    if (typeof state.heatLayer.setOptions === "function") {
      state.heatLayer.setOptions(getHeatOptions());
    }

    if (
      !animate ||
      !isMobileViewport() ||
      prefersReducedMotion() ||
      !state.heatPoints.length
    ) {
      stopHeatAnimation();
      state.heatLayer.setLatLngs(state.heatPoints);
      return;
    }

    animateHeatLayer();
  }

  function animateHeatLayer() {
    stopHeatAnimation();
    triggerHeatCanvasAnimation();

    const points = state.heatPoints.slice();
    const start = performance.now();
    const duration = HEAT_STYLE.MOBILE_ANIMATION_MS;

    const tick = (now) => {
      if (
        state.viewMode !== "heat" ||
        !state.map?.hasLayer(state.heatLayer)
      ) {
        stopHeatAnimation();
        return;
      }

      const progress = clamp((now - start) / duration, 0, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const intensity = 0.12 + eased * 0.88;

      state.heatLayer.setLatLngs(
        points.map((point) => [
          point[0],
          point[1],
          (point[2] || 1) * intensity
        ])
      );

      if (progress < 1) {
        state.heatAnimationFrame = window.requestAnimationFrame(tick);
      } else {
        state.heatLayer.setLatLngs(points);
        state.heatAnimationFrame = null;
      }
    };

    state.heatAnimationFrame = window.requestAnimationFrame(tick);
  }

  function triggerHeatCanvasAnimation() {
    if (!dom.map) return;

    window.clearTimeout(state.heatAnimationClassTimer);
    dom.map.classList.remove("is-heat-animating");
    void dom.map.offsetWidth;
    dom.map.classList.add("is-heat-animating");

    state.heatAnimationClassTimer = window.setTimeout(() => {
      dom.map.classList.remove("is-heat-animating");
    }, HEAT_STYLE.MOBILE_ANIMATION_MS + 80);
  }

  function stopHeatAnimation() {
    if (state.heatAnimationFrame) {
      window.cancelAnimationFrame(state.heatAnimationFrame);
      state.heatAnimationFrame = null;
    }

    window.clearTimeout(state.heatAnimationClassTimer);
  }

  function setBaseLayer(mode, { persist = true, notify = true } = {}) {
    if (!state.map) return;

    let nextMode = mode;

    if (!state.baseLayers[nextMode]) {
      nextMode = BASE_LAYER.OSM;
      if (notify) {
        showToast("Camada indisponivel neste navegador. Voltando para OSM.");
      }
    }

    const nextLayer = state.baseLayers[nextMode];
    if (!nextLayer) return;

    if (nextMode === BASE_LAYER.SATELLITE) {
      resetSatelliteHealth();
    } else {
      stopSatelliteHealth();
    }

    for (const layer of Object.values(state.baseLayers)) {
      if (layer && state.map.hasLayer(layer)) {
        state.map.removeLayer(layer);
      }
    }

    nextLayer.addTo(state.map);
    state.activeBaseLayer = nextLayer;
    state.baseMode = nextMode;
    syncBaseButtons();

    if (notify && nextMode === BASE_LAYER.SATELLITE && !state.satelliteNoticeShown) {
      state.satelliteNoticeShown = true;
      showToast("Satelite ativado sem Google. Carregamento depende da internet.");
    }

    if (persist) persistUiState();
  }

  function syncBaseButtons() {
    if (!dom.baseOsm || !dom.baseVector || !dom.baseSatellite) return;

    const buttons = [
      [dom.baseOsm, BASE_LAYER.OSM],
      [dom.baseVector, BASE_LAYER.VECTOR],
      [dom.baseSatellite, BASE_LAYER.SATELLITE]
    ];

    for (const [button, mode] of buttons) {
      const available = !state.map || Boolean(state.baseLayers[mode]);
      const active = state.baseMode === mode && available;

      button.disabled = !available;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    }
  }

  function handleSearchInput(event) {
    state.searchQuery = event.target.value.trim();
    state.searchFocusClientId = "";
    state.searchIntentOverride = null;
    state.searchResultIndex = -1;
    dom.clearSearch.classList.toggle("is-hidden", !state.searchQuery);

    clearTimeout(state.searchTimer);
    state.searchTimer = window.setTimeout(() => {
      applyFilters({ fit: shouldAutoFitSearchQuery(state.searchQuery) });
    }, 170);
  }

  function renderPremiumSearchResults() {
    const query = normalizeSearchText(state.searchQuery);

    if (!query) {
      state.searchSuggestions = [];
      hideSearchResults();
      return;
    }

    const suggestions = buildSearchSuggestions(query);
    state.searchSuggestions = suggestions;
    dom.searchResults.replaceChildren();

    if (!suggestions.length) {
      const empty = document.createElement("div");
      empty.className = "search-empty";
      empty.textContent = "Nenhuma sugestao encontrada com os filtros atuais.";
      dom.searchResults.appendChild(empty);
      showSearchResults();
      return;
    }

    suggestions.forEach((suggestion, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "search-result";
      button.setAttribute("role", "option");
      button.setAttribute(
        "aria-selected",
        String(index === state.searchResultIndex)
      );

      if (index === state.searchResultIndex) {
        button.classList.add("is-highlighted");
      }

      const type = document.createElement("span");
      type.className = `search-result-type is-${suggestion.type}`;
      type.textContent = suggestion.typeLabel;

      const copy = document.createElement("span");
      copy.className = "search-result-copy";

      const title = document.createElement("strong");
      title.textContent = suggestion.label;

      const secondary = document.createElement("span");
      secondary.textContent = suggestion.meta;

      copy.append(title, secondary);

      const location = document.createElement("span");
      location.className = "search-result-location";
      location.textContent = suggestion.countText;

      button.append(type, copy, location);
      button.addEventListener("click", () => selectSearchSuggestion(suggestion));

      dom.searchResults.appendChild(button);
    });

    showSearchResults();
  }

  function buildSearchSuggestions(query) {
    const lookupQuery = normalizeLookupText(query);
    if (!lookupQuery) return [];

    const pool = getClientsMatchingActiveFilters();
    const suggestions = [
      ...buildStateSuggestions(pool, lookupQuery),
      ...buildCitySuggestions(pool, lookupQuery),
      ...buildDistrictSuggestions(pool, lookupQuery),
      ...buildStreetSuggestions(pool, lookupQuery),
      ...buildClientSuggestions(pool, lookupQuery)
    ];

    return suggestions
      .sort(compareSearchSuggestions)
      .slice(0, SEARCH_LIMITS.TOTAL);
  }

  function getClientsMatchingActiveFilters() {
    return state.clients.filter((client) => {
      if (state.filters.uf && client.uf !== state.filters.uf) return false;
      if (
        state.filters.municipio &&
        client.municipio !== state.filters.municipio
      ) {
        return false;
      }
      if (
        state.filters.situacao &&
        client.situacao !== state.filters.situacao
      ) {
        return false;
      }
      return true;
    });
  }

  function buildStateSuggestions(pool, lookupQuery) {
    const groups = new Map();

    for (const client of pool) {
      if (!client.uf) continue;
      const label = formatStateLabel(client.uf);
      const aliases = [
        client.uf,
        label,
        BRAZIL_STATE_LABELS[client.uf]
      ].map(normalizeLookupText);

      if (!aliases.some((alias) => textMatchesLookup(alias, lookupQuery))) continue;

      const current = groups.get(client.uf) || {
        type: "state",
        typeLabel: "Estado",
        label,
        meta: "Limite territorial IBGE quando disponivel",
        count: 0,
        countText: "",
        inputValue: label,
        rank: getSuggestionRank(aliases[0], lookupQuery, 10),
        intent: { type: "state", uf: client.uf }
      };

      current.count += 1;
      current.countText = `${formatNumber(current.count)} clientes`;
      groups.set(client.uf, current);
    }

    return Array.from(groups.values())
      .sort(compareSearchSuggestions)
      .slice(0, SEARCH_LIMITS.STATES);
  }

  function buildCitySuggestions(pool, lookupQuery) {
    const groups = groupClients(pool, (client) =>
      client.municipio && client.uf
        ? `${normalizeLookupText(client.municipio)}|${client.uf}`
        : ""
    );

    return Array.from(groups.values())
      .map((group) => {
        const client = group.clients[0];
        const label = [client.municipio, client.uf].filter(Boolean).join(" - ");
        const lookup = normalizeLookupText(label);
        const cityLookup = normalizeLookupText(client.municipio);
        if (
          !textMatchesLookup(lookup, lookupQuery) &&
          !textMatchesLookup(cityLookup, lookupQuery)
        ) {
          return null;
        }

        return {
          type: "city",
          typeLabel: "Cidade",
          label,
          meta: "Zoom no municipio e limite IBGE quando disponivel",
          count: group.clients.length,
          countText: `${formatNumber(group.clients.length)} clientes`,
          inputValue: label,
          rank: getSuggestionRank(cityLookup, lookupQuery, 20),
          intent: {
            type: "city",
            city: cityLookup,
            cityName: client.municipio,
            uf: client.uf
          }
        };
      })
      .filter(Boolean)
      .sort(compareSearchSuggestions)
      .slice(0, SEARCH_LIMITS.CITIES);
  }

  function buildDistrictSuggestions(pool, lookupQuery) {
    if (lookupQuery.length < 2) return [];

    return buildPlaceSuggestions({
      pool,
      lookupQuery,
      type: "district",
      typeLabel: "Bairro",
      limit: SEARCH_LIMITS.DISTRICTS,
      rankBase: 35,
      labelGetter: (client) => cleanValue(client.bairro),
      intentGetter: (client) => ({
        type: "district",
        district: normalizeLookupText(client.bairro),
        city: normalizeLookupText(client.municipio),
        uf: client.uf
      })
    });
  }

  function buildStreetSuggestions(pool, lookupQuery) {
    if (lookupQuery.length < 3) return [];

    return buildPlaceSuggestions({
      pool,
      lookupQuery,
      type: "street",
      typeLabel: "Rua",
      limit: SEARCH_LIMITS.STREETS,
      rankBase: 45,
      labelGetter: (client) => cleanValue(client.logradouro),
      intentGetter: (client) => ({
        type: "street",
        street: normalizeLookupText(client.logradouro),
        district: normalizeLookupText(client.bairro),
        city: normalizeLookupText(client.municipio),
        uf: client.uf
      })
    });
  }

  function buildPlaceSuggestions({
    pool,
    lookupQuery,
    type,
    typeLabel,
    limit,
    rankBase,
    labelGetter,
    intentGetter
  }) {
    const groups = groupClients(pool, (client) => {
      const label = labelGetter(client);
      if (!label) return "";
      return `${normalizeLookupText(label)}|${normalizeLookupText(client.municipio)}|${client.uf}`;
    });

    return Array.from(groups.values())
      .map((group) => {
        const client = group.clients[0];
        const label = labelGetter(client);
        const lookup = normalizeLookupText(label);
        if (!textMatchesLookup(lookup, lookupQuery)) return null;

        const location = [client.municipio, client.uf].filter(Boolean).join(" - ");
        return {
          type,
          typeLabel,
          label,
          meta: location || "Localidade da base",
          count: group.clients.length,
          countText: `${formatNumber(group.clients.length)} clientes`,
          inputValue: [label, location].filter(Boolean).join(" - "),
          rank: getSuggestionRank(lookup, lookupQuery, rankBase),
          intent: intentGetter(client)
        };
      })
      .filter(Boolean)
      .sort(compareSearchSuggestions)
      .slice(0, limit);
  }

  function buildClientSuggestions(pool, lookupQuery) {
    return pool
      .filter((client) => {
        const searchable = normalizeLookupText(
          [
            client.displayName,
            client.razaoSocial,
            client.nomeFantasia,
            client.cnpj
          ].filter(Boolean).join(" ")
        );
        return textMatchesLookup(searchable, lookupQuery);
      })
      .map((client) => {
        const nameLookup = normalizeLookupText(client.displayName);
        const cnpjLookup = onlyDigits(client.cnpj);
        const digitQuery = onlyDigits(lookupQuery);
        const cnpjMatch = digitQuery && cnpjLookup.includes(digitQuery);
        const typeLabel = cnpjMatch ? "CNPJ" : "Cliente";

        return {
          type: cnpjMatch ? "cnpj" : "client",
          typeLabel,
          label: client.displayName,
          meta: client.cnpj || client.razaoSocial || "Cliente da base",
          count: 1,
          countText: [client.municipio, client.uf].filter(Boolean).join(" - "),
          inputValue: client.displayName,
          rank: getSuggestionRank(nameLookup, lookupQuery, cnpjMatch ? 4 : 60),
          intent: { type: "client", client }
        };
      })
      .sort(compareSearchSuggestions)
      .slice(0, SEARCH_LIMITS.CLIENTS);
  }

  function compareSearchSuggestions(a, b) {
    if (a.rank !== b.rank) return a.rank - b.rank;
    if (b.count !== a.count) return b.count - a.count;
    return a.label.localeCompare(b.label, "pt-BR", {
      sensitivity: "base",
      numeric: true
    });
  }

  function groupClients(clients, keyGetter) {
    const groups = new Map();

    for (const client of clients) {
      const key = keyGetter(client);
      if (!key) continue;
      const group = groups.get(key) || { key, clients: [] };
      group.clients.push(client);
      groups.set(key, group);
    }

    return groups;
  }

  function textMatchesLookup(text, query) {
    return Boolean(text && query && (text === query || text.startsWith(query) || text.includes(query)));
  }

  function getSuggestionRank(text, query, base) {
    if (text === query) return base;
    if (text.startsWith(query)) return base + 1;
    return base + 8;
  }

  function renderSearchResults() {
    return renderPremiumSearchResults();

    const query = normalizeSearchText(state.searchQuery);

    if (!query) {
      hideSearchResults();
      return;
    }

    const matches = state.filteredClients.slice(0, 8);
    dom.searchResults.replaceChildren();

    if (!matches.length) {
      const empty = document.createElement("div");
      empty.className = "search-empty";
      empty.textContent = "Nenhum cliente encontrado com os filtros atuais.";
      dom.searchResults.appendChild(empty);
      showSearchResults();
      return;
    }

    matches.forEach((client, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "search-result";
      button.setAttribute("role", "option");
      button.setAttribute(
        "aria-selected",
        String(index === state.searchResultIndex)
      );

      if (index === state.searchResultIndex) {
        button.classList.add("is-highlighted");
      }

      const dot = document.createElement("span");
      dot.className =
        normalizeSearchText(client.situacao) === "ativa"
          ? "search-result-dot"
          : "search-result-dot is-inactive";

      const copy = document.createElement("span");
      copy.className = "search-result-copy";

      const title = document.createElement("strong");
      title.textContent = client.displayName;

      const secondary = document.createElement("span");
      secondary.textContent =
        client.cnpj || client.razaoSocial || "Cliente sem CNPJ informado";

      copy.append(title, secondary);

      const location = document.createElement("span");
      location.className = "search-result-location";
      location.textContent = [client.municipio, client.uf]
        .filter(Boolean)
        .join(" • ");

      button.append(dot, copy, location);
      button.addEventListener("click", () => selectSearchResult(client));

      dom.searchResults.appendChild(button);
    });

    showSearchResults();
  }

  function handleSearchKeyboard(event) {
    return handlePremiumSearchKeyboard(event);

    if (!state.searchQuery) return;

    const matches = state.filteredClients.slice(0, 8);

    if (event.key === "ArrowDown") {
      event.preventDefault();
      state.searchResultIndex = Math.min(
        state.searchResultIndex + 1,
        matches.length - 1
      );
      renderSearchResults();
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      state.searchResultIndex = Math.max(state.searchResultIndex - 1, 0);
      renderSearchResults();
      return;
    }

    if (event.key === "Enter") {
      const selected =
        matches[state.searchResultIndex] || matches[0] || null;
      if (selected) {
        event.preventDefault();
        selectSearchResult(selected);
      }
      return;
    }

    if (event.key === "Escape") {
      hideSearchResults();
    }
  }

  function selectSearchResult(client) {
    return selectSearchSuggestion({
      type: "client",
      typeLabel: "Cliente",
      label: client.displayName,
      meta: client.cnpj || client.razaoSocial || "Cliente da base",
      countText: [client.municipio, client.uf].filter(Boolean).join(" - "),
      inputValue: client.displayName,
      intent: { type: "client", client }
    });
  }

  function handlePremiumSearchKeyboard(event) {
    if (!state.searchQuery) return;

    const suggestions = state.searchSuggestions.length
      ? state.searchSuggestions
      : buildSearchSuggestions(normalizeSearchText(state.searchQuery));

    if (event.key === "ArrowDown") {
      event.preventDefault();
      state.searchResultIndex = Math.min(
        state.searchResultIndex + 1,
        suggestions.length - 1
      );
      renderSearchResults();
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      state.searchResultIndex = Math.max(state.searchResultIndex - 1, 0);
      renderSearchResults();
      return;
    }

    if (event.key === "Enter") {
      const selected =
        suggestions[state.searchResultIndex] || suggestions[0] || null;
      if (selected) {
        event.preventDefault();
        selectSearchSuggestion(selected);
      }
      return;
    }

    if (event.key === "Escape") {
      hideSearchResults();
    }
  }

  function selectSearchSuggestion(suggestion) {
    const intent = suggestion?.intent;
    if (!intent) return;

    state.searchIntentOverride = intent;
    state.searchQuery = suggestion.inputValue || suggestion.label;
    state.searchFocusClientId = intent.type === "client" ? intent.client.id : "";
    state.searchResultIndex = -1;
    state.lastSearchFitKey = "";
    dom.searchInput.value = state.searchQuery;
    dom.clearSearch.classList.remove("is-hidden");
    hideSearchResults();
    applyFilters({ fit: true });

    if (intent.type === "client") {
      openClient(intent.client, { focusMap: false });
    }
  }

  function openClient(client, { focusMap = false, listMode = false } = {}) {
    state.selectedClient = client;
    const coordinateGroup = getCoordinateGroup(client);
    dom.clientPanel.classList.toggle("is-list-mode", listMode);

    const isActive = normalizeSearchText(client.situacao) === "ativa";
    const recordLabel = getRecordClassificationLabel(client);
    dom.clientStatus.textContent =
      client.classificacaoRegistro === "BASE_ORIGINAL"
        ? client.situacao || "Sem situação"
        : `${client.situacao || "Sem situação"} - ${recordLabel}`;
    dom.clientStatus.className = `status-badge ${
      isActive ? "" : "is-inactive"
    } ${
      client.classificacaoRegistro === "NOVO"
        ? "is-new"
        : client.classificacaoRegistro === "ATUALIZADO"
          ? "is-updated"
          : ""
    }`.trim();

    dom.clientTitle.textContent = client.displayName;
    dom.clientSubtitle.textContent =
      client.subtitle ||
      [client.municipio, client.uf].filter(Boolean).join(" - ");

    if (listMode) {
      dom.clientStatus.textContent = "Lista completa";
      dom.clientStatus.className = "status-badge is-list";
      dom.clientTitle.textContent = "Clientes neste ponto";
      dom.clientSubtitle.textContent = buildPointListSubtitle(coordinateGroup, client);
    }

    renderClientPreview(client);
    renderClientCommercialCard(client);

    const precision =
      PRECISION_META[client.geocodeStatus] || PRECISION_META.SEM_STATUS;
    dom.precisionTitle.textContent = precision.title;
    dom.precisionText.textContent =
      client.visualGroupSize > 1
        ? `${precision.text} Neste mapa, clientes com a mesma coordenada foram afastados apenas visualmente para facilitar a leitura.`
        : precision.text;

    setDetail("cnpj", dom.detailCnpj, client.cnpj);

    const address = formatAddress(client);
    setDetail("address", dom.detailAddress, address);

    const phones = [client.telefone, client.telefone1, client.whatsapp]
      .filter(Boolean)
      .map(formatPhone)
      .filter(Boolean);
    setDetail(
      "phone",
      dom.detailPhone,
      uniqueSorted(phones).join(" • ")
    );

    setDetail("cnae", dom.detailCnae, client.cnae);

    const sameCoordinateCount = client.coordinateKey
      ? state.coordinateCounts.get(client.coordinateKey) || 1
      : 0;

    setDetail(
      "same-coordinate",
      dom.detailSameCoordinate,
      sameCoordinateCount > 1
        ? `${formatNumber(sameCoordinateCount)} clientes compartilham esta coordenada aproximada. No zoom máximo, o agrupamento pode ser aberto para selecionar cada registro.`
        : ""
    );

    renderSameCoordinate(client, { listMode });
    renderNearbyClients(client, { listMode });
    updateClientActions(client);
    dom.clientMaintenanceActions.classList.toggle(
      "is-hidden",
      listMode ||
      !state.operator ||
      !["ADMIN", "MANUTENCAO", "EDITOR"].includes(state.operator.papel)
    );

    dom.clientPanel.classList.add("is-open");
    dom.clientPanel.classList.remove("is-collapsed");
    dom.clientPanel.setAttribute("aria-hidden", "false");
    syncModalBackdrop();

    if (listMode) {
      state.selectedLayer?.clearLayers();
    } else {
      highlightSelectedClient(client);
    }

    if (focusMap && !client.hasValidCoordinates) {
      showToast("Este cliente nao possui coordenada valida para centralizar no mapa.");
    }

    if (focusMap && client.hasValidCoordinates) {
      const currentZoom = state.map.getZoom();
      const targetZoom = Math.max(currentZoom, 12);

      state.map.flyTo(
        [client.visualLatitude, client.visualLongitude],
        Math.min(targetZoom, 14),
        {
          duration: prefersReducedMotion() ? 0 : 0.6
        }
      );
    }
  }

  function renderClientPreview(client) {
    dom.clientAvatar.textContent = getClientInitials(client);
    dom.previewLabel.textContent = client.hasValidCoordinates
      ? "Cliente selecionado"
      : "Sem ponto no mapa";
    dom.previewTitle.textContent = client.displayName;

    const meta = [
      [client.municipio, client.uf].filter(Boolean).join(" - "),
      client.situacao,
      formatCep(client.cep),
      client.visualGroupSize > 1
        ? `${formatNumber(client.visualGroupSize)} no ponto`
        : ""
    ].filter(Boolean);

    dom.previewMeta.textContent = meta.join(" / ");
  }

  function renderClientCommercialCard(client) {
    const profile = getClientCommercialProfile(client);

    dom.clientCommercialCard.className = `client-commercial-card is-${profile.level}`;
    dom.clientCommercialCard.style.setProperty("--score", `${profile.score * 3.6}deg`);
    dom.clientScoreValue.textContent = formatNumber(profile.score);
    dom.clientScoreLabel.textContent = profile.label;
    dom.clientScoreTitle.textContent = profile.title;
    dom.clientScoreText.textContent = profile.text;

    dom.clientSignalList.replaceChildren();
    profile.signals.forEach((signal) => {
      const chip = document.createElement("span");
      chip.className = `client-signal is-${signal.tone}`;
      chip.textContent = signal.label;
      dom.clientSignalList.appendChild(chip);
    });
  }

  function getClientCommercialProfile(client) {
    const active = normalizeSearchText(client.situacao) === "ativa";
    const hasPhone = Boolean(buildTelHref(client));
    const addressParts = [
      client.logradouro,
      client.bairro,
      client.municipio,
      client.uf
    ].filter((value) => cleanValue(value));
    const addressQuality = addressParts.length / 4;
    const precision = getPrecisionMeta(client.geocodeStatus);
    const cityContext = getClientCityContext(client);
    const nearbyCount = getNearbyClients(client, {
      radiusMeters: 5000,
      limit: Infinity
    }).length;
    const sameCoordinateCount = client.coordinateKey
      ? state.coordinateCounts.get(client.coordinateKey) || 1
      : 0;
    const missingCritical = [
      !client.cnpj,
      !hasPhone,
      !client.logradouro,
      !client.bairro,
      !client.cnae,
      !client.hasValidCoordinates
    ].filter(Boolean).length;

    let score = 34;
    score += active ? 18 : -10;
    score += hasPhone ? 12 : -6;
    score += client.cnpj ? 7 : -5;
    score += client.cnae ? 5 : 0;
    score += Math.round(addressQuality * 14);
    score += client.hasValidCoordinates ? 8 : -18;
    score += client.geocodeStatus === "PRECISO_LOGRADOURO" ? 8 : 0;
    score += client.geocodeStatus === "APROX_SEDE_MUNICIPIO" ? -5 : 0;
    score += Math.min(10, Math.floor(cityContext.count / 6));
    score += nearbyCount >= 8 ? 8 : nearbyCount >= 3 ? 5 : nearbyCount > 0 ? 2 : 0;
    score += sameCoordinateCount > 1 ? 2 : 0;
    score -= missingCritical * 3;
    score = clamp(Math.round(score), 0, active ? 100 : 64);

    const level =
      score >= 76 ? "high" : score >= 56 ? "medium" : score >= 38 ? "review" : "low";
    const label =
      level === "high"
        ? "Alta"
        : level === "medium"
          ? "Media"
          : level === "review"
            ? "Revisar"
            : "Baixa";
    const title =
      level === "high"
        ? "Prioridade comercial alta"
        : level === "medium"
          ? "Bom alvo para abordagem"
          : level === "review"
            ? "Dados pedem revisao"
            : "Prioridade baixa";
    const text =
      level === "high"
        ? "Registro ativo, com bons sinais de contato/localizacao e presenca relevante no territorio."
        : level === "medium"
          ? "Cliente aproveitavel para rota ou prospeccao, com alguns pontos de dados para confirmar."
          : level === "review"
            ? "Antes da abordagem, vale revisar contato, endereco ou precisao do ponto."
            : "Registro com poucos sinais comerciais ou situacao menos favoravel no momento.";

    const dataQuality = Math.round(((6 - missingCritical) / 6) * 100);
    const signals = [
      {
        label: active ? "Ativo" : "Situacao revisar",
        tone: active ? "success" : "warning"
      },
      {
        label: hasPhone ? "Contato ok" : "Sem telefone",
        tone: hasPhone ? "success" : "warning"
      },
      {
        label: client.hasValidCoordinates ? precision.title : "Sem coordenada",
        tone: client.hasValidCoordinates ? "focus" : "warning"
      },
      {
        label: `${formatNumber(cityContext.count)} na cidade`,
        tone: cityContext.count >= 8 ? "focus" : "muted"
      },
      {
        label: `${formatNumber(nearbyCount)} em 5 km`,
        tone: nearbyCount ? "focus" : "muted"
      },
      {
        label: `${formatNumber(dataQuality)}% dados`,
        tone: dataQuality >= 80 ? "success" : dataQuality >= 55 ? "muted" : "warning"
      }
    ];

    return { score, level, label, title, text, signals };
  }

  function getClientCityContext(client) {
    const city = normalizeLookupText(client.municipio);
    const uf = cleanValue(client.uf);
    const clients = state.clients.filter((item) =>
      normalizeLookupText(item.municipio) === city && (!uf || item.uf === uf)
    );

    return {
      count: clients.length,
      active: clients.filter((item) => normalizeSearchText(item.situacao) === "ativa").length
    };
  }

  function getNearbyClients(client, { radiusMeters = 5000, limit = 5 } = {}) {
    if (!client?.hasValidCoordinates || !state.map) return [];

    const origin = [client.latitude, client.longitude];
    return state.clients
      .filter((item) =>
        item.id !== client.id &&
        item.hasValidCoordinates &&
        item.coordinateKey !== client.coordinateKey
      )
      .map((item) => ({
        client: item,
        distance: state.map.distance(origin, [item.latitude, item.longitude])
      }))
      .filter((item) => item.distance <= radiusMeters)
      .sort((a, b) => {
        if (a.distance !== b.distance) return a.distance - b.distance;
        return String(a.client.displayName).localeCompare(String(b.client.displayName), "pt-BR", {
          sensitivity: "base",
          numeric: true
        });
      })
      .slice(0, limit);
  }

  function renderNearbyClients(client, { listMode = false } = {}) {
    dom.nearbyClientList.replaceChildren();

    if (listMode || !client.hasValidCoordinates) {
      dom.nearbyClients.classList.add("is-hidden");
      return;
    }

    const allNearby = getNearbyClients(client, { radiusMeters: 5000, limit: Infinity });
    const nearby = allNearby.slice(0, 4);
    dom.nearbyClients.classList.toggle("is-hidden", !nearby.length);
    if (!nearby.length) return;

    dom.nearbyTitle.textContent = "Clientes proximos";
    dom.nearbyCount.textContent = `${formatNumber(allNearby.length)} em ate 5 km`;

    nearby.forEach(({ client: item, distance }) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "nearby-client-card";
      button.setAttribute("aria-label", `Abrir ficha de ${item.displayName}`);

      const copy = document.createElement("span");
      copy.className = "nearby-client-copy";

      const title = document.createElement("strong");
      title.textContent = item.displayName;

      const meta = document.createElement("small");
      meta.textContent = [
        formatCompactDistance(distance),
        [item.bairro, item.municipio, item.uf].filter(Boolean).join(" - ")
      ].filter(Boolean).join(" / ");

      copy.append(title, meta);

      const status = document.createElement("span");
      status.className =
        normalizeSearchText(item.situacao) === "ativa"
          ? "nearby-client-status"
          : "nearby-client-status is-inactive";
      status.textContent = item.situacao || "Base";

      button.append(copy, status);
      button.addEventListener("click", () => openClient(item, { focusMap: true }));
      dom.nearbyClientList.appendChild(button);
    });
  }

  function buildPointListSubtitle(group, client) {
    const location = [
      cleanValue(client.bairro),
      [client.municipio, client.uf].filter(Boolean).join(" - ")
    ].filter(Boolean).join(" / ");

    return [
      `${formatNumber(group.length)} clientes compartilhando a mesma coordenada`,
      location || "Localizacao aproximada"
    ].join(" - ");
  }

  function sortPointClients(group, selectedClient, { listMode = false } = {}) {
    return group.slice().sort((a, b) => {
      if (!listMode) {
        if (a.id === selectedClient.id) return -1;
        if (b.id === selectedClient.id) return 1;
      }

      const aActive = normalizeSearchText(a.situacao) === "ativa";
      const bActive = normalizeSearchText(b.situacao) === "ativa";
      if (aActive !== bActive) return aActive ? -1 : 1;

      return String(a.displayName).localeCompare(String(b.displayName), "pt-BR", {
        sensitivity: "base",
        numeric: true
      });
    });
  }

  function buildPointClientSubtitle(client, { listMode = false } = {}) {
    const location = [
      cleanValue(client.bairro),
      [client.municipio, client.uf].filter(Boolean).join(" - ")
    ].filter(Boolean).join(" / ");

    if (!listMode) {
      return client.cnpj || client.razaoSocial || location;
    }

    return [
      client.cnpj ? `CNPJ ${client.cnpj}` : client.razaoSocial,
      formatCep(client.cep),
      location
    ].filter(Boolean).join(" / ");
  }

  function renderCoordinatePreview(client, { listMode = false } = {}) {
    dom.coordinatePreviewList.replaceChildren();

    const group = sortPointClients(getCoordinateGroup(client), client, { listMode });

    dom.coordinatePreview.classList.toggle("is-hidden", group.length <= 1);
    dom.coordinatePreview.classList.toggle("is-list-mode", listMode);
    if (group.length <= 1) return;

    dom.coordinatePreviewTitle.textContent = listMode
      ? "Lista completa"
      : "Clientes neste ponto";
    dom.coordinatePreviewCount.textContent = `${formatNumber(group.length)} clientes`;

    group.forEach((item) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "preview-client-card";
      if (!listMode && item.id === client.id) button.classList.add("is-selected");
      button.setAttribute("aria-label", `Abrir ficha de ${item.displayName}`);

      const active = normalizeSearchText(item.situacao) === "ativa";

      const dot = document.createElement("span");
      dot.className = active ? "preview-client-dot" : "preview-client-dot is-inactive";

      const copy = document.createElement("span");
      copy.className = "preview-client-copy";

      const title = document.createElement("strong");
      title.textContent = item.displayName;

      const subtitle = document.createElement("span");
      subtitle.textContent = buildPointClientSubtitle(item, { listMode });

      copy.append(title, subtitle);

      const status = document.createElement("span");
      status.className = active ? "preview-client-status" : "preview-client-status is-inactive";
      status.textContent = item.situacao || "Base";

      button.append(dot, copy, status);
      button.addEventListener("click", () => openClient(item, { focusMap: false }));
      dom.coordinatePreviewList.appendChild(button);
    });
  }

  function renderSameCoordinate(client, { listMode = false } = {}) {
    renderCoordinatePreview(client, { listMode });

    const row = document.querySelector('[data-field="same-coordinate"]');
    if (!row) return;
    row.classList.add("is-hidden");
    dom.detailSameCoordinate.replaceChildren();
  }

  function updateClientActions(client) {
    const telHref = buildTelHref(client);
    dom.callClient.classList.toggle("is-hidden", !telHref);
    dom.callClient.href = telHref || "#";

    const mapsUrl = buildGoogleMapsUrl(client);
    dom.openMapsClient.classList.toggle("is-hidden", !mapsUrl);
    dom.openMapsClient.href = mapsUrl || "#";

    const directionsUrl = buildDirectionsUrl(client);
    dom.routeClient.classList.toggle("is-hidden", !directionsUrl);
    dom.routeClient.href = directionsUrl || "#";
    dom.routeClientBottom.classList.toggle("is-hidden", !directionsUrl);
    dom.routeClientBottom.href = directionsUrl || "#";

    const address = formatAddress(client);
    dom.copyAddressClient.disabled = !address;
    dom.copyMapsClient.disabled = !mapsUrl;
  }

  function closeClientPanel() {
    state.selectedClient = null;
    dom.clientPanel.classList.remove("is-open", "is-collapsed", "is-list-mode");
    dom.clientPanel.setAttribute("aria-hidden", "true");
    state.selectedLayer?.clearLayers();
    syncModalBackdrop();
  }

  function toggleMobileSheet() {
    if (!dom.clientPanel.classList.contains("is-open")) return;
    dom.clientPanel.classList.toggle("is-collapsed");
  }

  function highlightSelectedClient(client) {
    state.selectedLayer.clearLayers();

    if (!client.hasValidCoordinates) return;

    const recordClass =
      client.classificacaoRegistro === "NOVO"
        ? "is-new"
        : client.classificacaoRegistro === "ATUALIZADO"
          ? "is-updated"
          : "";
    const icon = L.divIcon({
      className: "selected-marker-icon",
      html: `<div class="selected-marker ${recordClass}" aria-hidden="true"><span class="selected-marker-label">${escapeHtml(shortenLabel(client.displayName, 34))}</span></div>`,
      iconSize: [42, 42],
      iconAnchor: [21, 21]
    });

    L.marker([client.visualLatitude, client.visualLongitude], {
      icon,
      interactive: false,
      keyboard: false,
      zIndexOffset: 1000
    }).addTo(state.selectedLayer);
  }

  async function copySelectedClient() {
    const client = state.selectedClient;
    if (!client) return;

    const lines = [
      client.displayName,
      client.razaoSocial &&
      client.razaoSocial !== client.displayName
        ? client.razaoSocial
        : null,
      client.cnpj ? `CNPJ: ${client.cnpj}` : null,
      client.situacao ? `Situação: ${client.situacao}` : null,
      formatAddress(client) ? `Endereço: ${formatAddress(client)}` : null,
      [client.telefone, client.telefone1, client.whatsapp].filter(Boolean).length
        ? `Telefone: ${[client.telefone, client.telefone1, client.whatsapp]
            .filter(Boolean)
            .map(formatPhone)
            .join(" / ")}`
        : null,
      client.cnae ? `Atividade: ${client.cnae}` : null
    ].filter(Boolean);

    const text = lines.join("\n");

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        fallbackCopy(text);
      }
      showToast("Dados do cliente copiados.");
    } catch (error) {
      console.error("[Mapa de clientes] Falha ao copiar:", error);
      showToast("Não foi possível copiar automaticamente.");
    }
  }

  async function copySelectedClientAddress() {
    const client = state.selectedClient;
    if (!client) return;

    const address = formatAddress(client);
    if (!address) {
      showToast("Este cliente nao possui endereco para copiar.");
      return;
    }

    await copyTextToClipboard(address, "Endereco copiado.");
  }

  async function copySelectedClientMaps() {
    const client = state.selectedClient;
    if (!client) return;

    const mapsUrl = buildGoogleMapsUrl(client);
    if (!mapsUrl) {
      showToast("Este cliente nao possui link de mapa.");
      return;
    }

    await copyTextToClipboard(mapsUrl, "Link do Maps copiado.");
  }

  async function copyTextToClipboard(text, successMessage) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        fallbackCopy(text);
      }
      showToast(successMessage);
    } catch (error) {
      console.error("[Mapa de clientes] Falha ao copiar:", error);
      showToast("Nao foi possivel copiar automaticamente.");
    }
  }

  function fitFilteredClients(searchIntent = null) {
    if (!state.map) return;

    const points = state.filteredClients
      .filter((client) => client.hasValidCoordinates)
      .map((client) => [client.visualLatitude, client.visualLongitude]);

    if (!points.length) {
      if (state.filteredClients.length) {
        showToast("Os clientes filtrados nao possuem coordenadas validas para mostrar no mapa.");
      }
      return;
    }

    if (points.length === 1) {
      state.map.flyTo(points[0], getSearchFitZoom(searchIntent, 12), {
        duration: prefersReducedMotion() ? 0 : 0.55
      });
      return;
    }

    const bounds = L.latLngBounds(points);
    const maxZoom = getSearchFitZoom(searchIntent, 12);

    state.map.fitBounds(bounds, {
      paddingTopLeft: [28, 170],
      paddingBottomRight: [28, 40],
      maxZoom,
      animate: !prefersReducedMotion(),
      duration: 0.55
    });
  }

  function getSearchFitZoom(searchIntent, fallbackZoom) {
    if (!searchIntent) return fallbackZoom;
    if (searchIntent.type === "state") return 7;
    if (searchIntent.type === "city") return 12;
    if (searchIntent.type === "district") return 14;
    if (searchIntent.type === "street") return 15;
    if (searchIntent.type === "client") return 15;
    return fallbackZoom;
  }

  function fitBrazil() {
    if (!state.map) return;

    state.map.fitBounds(L.latLngBounds(BRAZIL_BOUNDS), {
      padding: [18, 18],
      animate: !prefersReducedMotion(),
      duration: 0.55
    });
  }

  function resetFilters() {
    state.filters.uf = "";
    state.filters.municipio = "";
    state.filters.situacao = "";

    dom.filterUf.value = "";
    dom.filterSituacao.value = "";
    refreshMunicipioOptions();
    dom.filterMunicipio.value = "";

    persistUiState();
    applyFilters({ fit: true });
  }

  function setSelectOptions(select, items, placeholder, selectedValue) {
    select.replaceChildren();

    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = placeholder;
    select.appendChild(empty);

    for (const item of items) {
      const option = document.createElement("option");
      option.value = item;
      option.textContent = item;
      if (item === selectedValue) option.selected = true;
      select.appendChild(option);
    }
  }

  function setDetail(field, target, value) {
    const row = document.querySelector(`[data-field="${field}"]`);
    if (!row) return;

    const visible = Boolean(String(value || "").trim());
    row.classList.toggle("is-hidden", !visible);

    if (visible) target.textContent = value;
  }

  function showSearchResults() {
    dom.searchResults.classList.remove("is-hidden");
    dom.searchInput.setAttribute("aria-expanded", "true");
  }

  function hideSearchResults() {
    dom.searchResults.classList.add("is-hidden");
    dom.searchInput.setAttribute("aria-expanded", "false");
    state.searchResultIndex = -1;
  }

  function startUpdateChecks() {
    if (!window.fetch || window.location.protocol === "file:") return;

    window.setTimeout(checkForAppUpdate, VERSION_CHECK.INITIAL_DELAY_MS);

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) checkForAppUpdate();
    });
  }

  async function checkForAppUpdate() {
    if (state.updateReloading) return;

    window.clearTimeout(state.updateCheckTimer);

    try {
      const response = await fetch(
        `${VERSION_CHECK.URL}?t=${Date.now()}`,
        {
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache",
            Pragma: "no-cache"
          }
        }
      );

      if (!response.ok) return;

      const payload = await response.json();
      const nextVersion = cleanValue(payload?.version);

      if (nextVersion && nextVersion !== APP_VERSION) {
        forceAppUpdate(nextVersion);
        return;
      }
    } catch (error) {
      console.warn("[Mapa de clientes] Nao foi possivel verificar atualizacao:", error);
    } finally {
      if (!state.updateReloading) {
        state.updateCheckTimer = window.setTimeout(
          checkForAppUpdate,
          VERSION_CHECK.INTERVAL_MS
        );
      }
    }
  }

  function forceAppUpdate(nextVersion) {
    state.updateReloading = true;
    showToast("Nova versao publicada. Atualizando automaticamente...");

    window.setTimeout(() => {
      const url = new URL(window.location.href);
      url.searchParams.set("app_version", nextVersion);
      window.location.replace(url.toString());
    }, VERSION_CHECK.RELOAD_DELAY_MS);
  }

  function showLoadingStatus(title, message) {
    dom.statusTitle.textContent = title;
    dom.statusMessage.textContent = message;
    dom.statusSpinner.classList.remove("is-hidden");
    dom.statusAction.classList.add("is-hidden");
    dom.appStatus.classList.remove("is-hidden");
  }

  function showSetupStatus(title, message) {
    dom.statusTitle.textContent = title;
    dom.statusMessage.textContent = message;
    dom.statusSpinner.classList.add("is-hidden");
    dom.statusAction.classList.add("is-hidden");
    dom.appStatus.classList.remove("is-hidden");
  }

  function showErrorStatus(title, message) {
    dom.statusTitle.textContent = title;
    dom.statusMessage.textContent = message;
    dom.statusSpinner.classList.add("is-hidden");
    dom.statusAction.classList.remove("is-hidden");
    dom.appStatus.classList.remove("is-hidden");
  }

  function showFatalStatus(title, message) {
    showSetupStatus(title, message);
  }

  function hideStatus() {
    dom.appStatus.classList.add("is-hidden");
  }

  function showToast(message) {
    clearTimeout(state.toastTimer);
    dom.toast.textContent = message;
    dom.toast.classList.add("is-visible");

    state.toastTimer = window.setTimeout(() => {
      dom.toast.classList.remove("is-visible");
    }, 2400);
  }

  function restoreUiState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");

      if (saved?.viewMode === "heat" || saved?.viewMode === "markers") {
        state.viewMode = saved.viewMode;
      }

      if (
        saved?.baseMode === BASE_LAYER.OSM ||
        saved?.baseMode === BASE_LAYER.VECTOR ||
        saved?.baseMode === BASE_LAYER.SATELLITE
      ) {
        state.baseMode = saved.baseMode;
      }

      if (saved?.filters && typeof saved.filters === "object") {
        state.filters = {
          uf: cleanValue(saved.filters.uf) || "",
          municipio: cleanValue(saved.filters.municipio) || "",
          situacao: cleanValue(saved.filters.situacao) || ""
        };
      }
    } catch {
      // Preferências locais são opcionais.
    }
  }

  function persistUiState() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          viewMode: state.viewMode,
          baseMode: state.baseMode,
          filters: state.filters
        })
      );
    } catch {
      // O mapa segue funcionando quando storage estiver bloqueado.
    }
  }

  function inferSupabaseUrlFromJwt(key) {
    if (!key || key.startsWith("sb_")) return "";

    const parts = key.split(".");
    if (parts.length !== 3) return "";

    try {
      const payloadText = decodeBase64Url(parts[1]);
      const payload = JSON.parse(payloadText);
      const ref = typeof payload.ref === "string" ? payload.ref.trim() : "";

      if (/^[a-z0-9]{10,40}$/i.test(ref)) {
        return `https://${ref}.supabase.co`;
      }
    } catch {
      return "";
    }

    return "";
  }

  function decodeBase64Url(value) {
    const normalized = value
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(value.length / 4) * 4, "=");

    return decodeURIComponent(
      Array.from(atob(normalized))
        .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`)
        .join("")
    );
  }

  function friendlySupabaseError(error) {
    const message = String(error?.message || error || "");

    if (/relation .* does not exist|could not find the table/i.test(message)) {
      return `A tabela "${CONFIG.TABLE_NAME}" não foi encontrada. Importe a aba Base_Mapa usando exatamente esse nome, ou altere CONFIG.TABLE_NAME em app.js.`;
    }

    if (/permission denied|row-level security|rls/i.test(message)) {
      return "O Supabase bloqueou a leitura. Revise a política RLS/SELECT da tabela para a função anon.";
    }

    if (/failed to fetch|network/i.test(message)) {
      return "Falha de rede ao acessar o Supabase. Confira a URL do projeto, a chave pública e sua conexão.";
    }

    return message || "Erro inesperado ao consultar o Supabase.";
  }

  function formatAddress(client) {
    const locality = [client.municipio, client.uf].filter(Boolean).join(" - ");
    const cep = formatCep(client.cep);

    return [client.logradouro, client.bairro, locality, cep]
      .filter(Boolean)
      .join(", ");
  }

  function getClientInitials(client) {
    const source = normalizeSearchText(client.displayName)
      ? client.displayName
      : client.cnpj || "CL";
    const words = String(source)
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    if (!words.length) return "CL";

    const first = words[0]?.[0] || "";
    const second = words.length > 1 ? words[1]?.[0] || "" : words[0]?.[1] || "";
    return `${first}${second}`.toUpperCase().slice(0, 2);
  }

  function shortenLabel(value, maxLength) {
    const text = cleanValue(value);
    if (text.length <= maxLength) return text;
    return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}...`;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function buildAddressQuery(client) {
    const rawAddress = cleanOptionalValue(client.raw?.endereco_busca);
    if (rawAddress && hasUsefulAddressText(rawAddress, client)) {
      return rawAddress;
    }

    return [
      client.logradouro,
      client.bairro,
      [client.municipio, client.uf].filter(Boolean).join(" - "),
      client.cep,
      "Brasil"
    ]
      .filter(Boolean)
      .join(", ");
  }

  function buildGoogleMapsUrl(client) {
    if (hasConfirmedMapPoint(client)) {
      const latitude = Number(client.latitude).toFixed(6);
      const longitude = Number(client.longitude).toFixed(6);
      return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    }

    const query = buildAddressQuery(client);
    if (!query) return "";
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }

  function buildDirectionsUrl(client) {
    if (hasConfirmedMapPoint(client)) {
      const latitude = Number(client.latitude).toFixed(6);
      const longitude = Number(client.longitude).toFixed(6);
      return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
    }

    const query = buildAddressQuery(client);
    if (!query) return "";
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`;
  }

  function hasConfirmedMapPoint(client) {
    return Boolean(
      client?.hasValidCoordinates &&
      cleanValue(client.geocodeStatus).toUpperCase() === "CONFIRMADA_CAMPO"
    );
  }

  function hasUsefulAddressText(address, client) {
    const normalizedAddress = normalizeSearchText(address);
    if (!normalizedAddress) return false;

    const hasCity = client.municipio
      ? normalizedAddress.includes(normalizeSearchText(client.municipio))
      : true;
    const hasUf = client.uf
      ? normalizedAddress.includes(normalizeSearchText(client.uf))
      : true;
    const hasBrazil = /\bbrasil\b|\bbrazil\b/.test(normalizedAddress);
    const hasCep = /\b\d{5}-?\d{3}\b/.test(address);
    const hasStreetOrDistrict = Boolean(client.logradouro || client.bairro);

    return hasCity && hasUf && (hasBrazil || hasCep || hasStreetOrDistrict);
  }

  function buildTelHref(client) {
    const phone = [client.telefone, client.telefone1, client.whatsapp]
      .map(normalizePhoneDigits)
      .find(Boolean);

    return phone ? `tel:${phone}` : "";
  }

  function normalizePhoneDigits(value) {
    const digits = String(value || "").replace(/\D/g, "");
    if (!digits || /^0+$/.test(digits)) return "";

    if (digits.length === 10 || digits.length === 11) {
      return `+55${digits}`;
    }

    if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) {
      return `+${digits}`;
    }

    return "";
  }

  function formatCep(value) {
    const digits = String(value || "").replace(/\D/g, "");
    if (digits.length !== 8) return cleanValue(value) || "";
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  }

  function formatPhone(value) {
    const digits = String(value || "").replace(/\D/g, "");
    if (!digits) return "";

    if (digits.length === 11) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    }

    if (digits.length === 10) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    }

    return cleanValue(value) || digits;
  }

  function sanitizePhone(value) {
    const cleaned = cleanOptionalValue(value);
    if (!cleaned) return "";

    return normalizePhoneDigits(cleaned) ? String(cleaned) : "";
  }

  function cleanValue(value) {
    if (value === null || value === undefined) return "";
    return String(value).trim();
  }

  function cleanOptionalValue(value) {
    const text = cleanValue(value);
    return !text || text === "13" ? "" : text;
  }

  function toNumber(value) {
    if (typeof value === "number") return value;
    if (value === null || value === undefined || value === "") return NaN;

    const normalized = String(value)
      .trim()
      .replace(/\s/g, "")
      .replace(",", ".");

    const result = Number(normalized);
    return Number.isFinite(result) ? result : NaN;
  }

  function normalizeSearchText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeLookupText(value) {
    return normalizeSearchText(value)
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function onlyDigits(value) {
    return String(value || "").replace(/\D+/g, "");
  }

  function uniqueSorted(values) {
    return Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
      String(a).localeCompare(String(b), "pt-BR", {
        sensitivity: "base",
        numeric: true
      })
    );
  }

  function optionExists(select, value) {
    if (!value) return true;
    return Array.from(select.options).some((option) => option.value === value);
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("pt-BR").format(Number(value) || 0);
  }

  function formatPercent(part, total) {
    const numerator = Number(part) || 0;
    const denominator = Number(total) || 0;
    if (!denominator) return "0%";

    const value = (numerator / denominator) * 100;
    const digits = value > 0 && value < 10 ? 1 : 0;

    return new Intl.NumberFormat("pt-BR", {
      maximumFractionDigits: digits,
      minimumFractionDigits: 0
    }).format(value) + "%";
  }

  function formatCompactDistance(meters) {
    const value = Number(meters) || 0;

    if (value >= 100000) {
      return `${formatNumber(Math.round(value / 1000))} km`;
    }

    if (value >= 1000) {
      return `${new Intl.NumberFormat("pt-BR", {
        maximumFractionDigits: 1,
        minimumFractionDigits: 0
      }).format(value / 1000)} km`;
    }

    return `${formatNumber(Math.round(value))} m`;
  }

  function formatStateLabel(uf) {
    const code = cleanValue(uf).toUpperCase();
    if (!code) return "";
    return BRAZIL_STATE_LABELS[code] ? `${BRAZIL_STATE_LABELS[code]} (${code})` : code;
  }

  function fallbackCopy(text) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }

  function prefersReducedMotion() {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  }

  function isTouchInteraction() {
    return Boolean(
      window.matchMedia?.("(pointer: coarse)")?.matches ||
      Number(window.navigator?.maxTouchPoints || 0) > 0
    );
  }

  function isMobileViewport() {
    return isTouchInteraction() || window.innerWidth <= 640;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function debounce(fn, wait = 120) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = window.setTimeout(() => fn(...args), wait);
    };
  }

  function toCamelCase(value) {
    return value.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
  }

  function getCurrentAppVersion() {
    const pageVersion = readUrlParam(window.location.href, "app_version");
    const scriptVersion = readUrlParam(document.currentScript?.src, "v");
    return pageVersion || scriptVersion || APP_VERSION_FALLBACK;
  }

  function readUrlParam(url, key) {
    if (!url) return "";

    try {
      return String(new URL(url, window.location.href).searchParams.get(key) || "").trim();
    } catch {
      return "";
    }
  }
})();
