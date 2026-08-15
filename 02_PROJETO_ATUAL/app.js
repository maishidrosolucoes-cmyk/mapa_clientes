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
  const CONFIG = Object.freeze({
    SUPABASE_URL: "",
    SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB3bWdiYXh5d3Z5eWZtbGt5Z3FyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNDI3NDAsImV4cCI6MjA5MjkxODc0MH0.kSYonDj0VBHjMZuVlGeVQjAuMmbEBMQfB4OsBcZOecg",
    SCHEMA_NAME: "mapa_clientes",
    TABLE_NAME: "base_mapa",
    PAGE_SIZE: 1000
  });

  const APP_VERSION_FALLBACK = "20260815-auto-refresh1";
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
    WHEEL_DEBOUNCE_TIME: 12
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

  const OPENFREEMAP_ATTRIBUTION =
    '<a href="https://openfreemap.org/" target="_blank" rel="noopener">OpenFreeMap</a> &copy; <a href="https://openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';

  const SATELLITE_ATTRIBUTION =
    '<a href="https://www.esri.com/" target="_blank" rel="noopener">Esri</a> World Imagery, DigitalGlobe, GeoEye, USDA FSA, USGS, AEX, Getmapping, Aerogrid, IGN, IGP, swisstopo, and the GIS User Community';

  const PRECISION_META = Object.freeze({
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
    heatPoints: [],
    selectedLayer: null,
    baseLayers: {},
    activeBaseLayer: null,
    markerById: new Map(),
    coordinateCounts: new Map(),
    selectedClient: null,
    searchQuery: "",
    searchFocusClientId: "",
    searchResultIndex: -1,
    lastSearchFitKey: "",
    viewMode: "markers",
    baseMode: BASE_LAYER.OSM,
    reportOpen: false,
    filters: {
      uf: "",
      municipio: "",
      situacao: ""
    },
    toastTimer: null,
    searchTimer: null,
    regionTimer: null,
    updateCheckTimer: null,
    updateReloading: false,
    heatAnimationFrame: null,
    heatAnimationClassTimer: null,
    satelliteNoticeShown: false,
    satelliteErrorShown: false,
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
      "search-input",
      "clear-search",
      "search-results",
      "filter-uf",
      "filter-municipio",
      "filter-situacao",
      "reset-filters",
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
      "call-client",
      "open-maps-client",
      "copy-client",
      "report-panel",
      "close-report",
      "report-context",
      "report-total-value",
      "report-total-note",
      "report-coverage-value",
      "report-coverage-note",
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
      fadeAnimation: true,
      markerZoomAnimation: !mobileViewport,
      zoomAnimationThreshold: 3,
      inertia: true,
      inertiaDeceleration: mobileViewport ? 3400 : 2600,
      inertiaMaxSpeed: mobileViewport ? 2100 : 1700,
      easeLinearity: mobileViewport ? 0.2 : 0.18,
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

    state.map.on("click", () => {
      hideSearchResults();
    });

    state.map.on("move zoom", scheduleRegionReadoutUpdate);
    state.map.on("moveend zoomend", updateRegionReadout);
    updateRegionReadout();

    applyViewMode({ persist: false });
  }

  function initBaseLayers() {
    const mobileViewport = isMobileViewport();
    const tileOptions = {
      noWrap: false,
      keepBuffer: mobileViewport ? 5 : 3,
      updateWhenIdle: mobileViewport,
      updateWhenZooming: !mobileViewport,
      updateInterval: mobileViewport ? 150 : 80,
      detectRetina: true
    };

    state.baseLayers = {
      [BASE_LAYER.OSM]: L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
        maxZoom: 19,
        maxNativeZoom: 19,
        ...tileOptions
      }),
    };

    const satelliteImagery = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        attribution: SATELLITE_ATTRIBUTION,
        maxZoom: 19,
        maxNativeZoom: 19,
        ...tileOptions
      }
    );

    const satelliteLabels = L.tileLayer(
      "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
      {
        maxZoom: 19,
        maxNativeZoom: 19,
        opacity: mobileViewport ? 0.9 : 0.78,
        ...tileOptions,
        keepBuffer: mobileViewport ? 4 : 2
      }
    );

    state.baseLayers[BASE_LAYER.SATELLITE] = L.layerGroup([
      satelliteImagery,
      satelliteLabels
    ]);

    satelliteImagery.on("tileerror", () => {
      if (state.baseMode !== BASE_LAYER.SATELLITE || state.satelliteErrorShown) return;
      state.satelliteErrorShown = true;
      showToast("Satelite nao carregou agora. Use OSM ou Vetor e tente novamente depois.");
    });

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

  function bindEvents() {
    dom.searchInput.addEventListener("input", handleSearchInput);
    dom.searchInput.addEventListener("focus", () => {
      if (state.searchQuery) renderSearchResults();
    });
    dom.searchInput.addEventListener("keydown", handleSearchKeyboard);

    dom.clearSearch.addEventListener("click", () => {
      dom.searchInput.value = "";
      state.searchQuery = "";
      state.searchFocusClientId = "";
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
    dom.openReport.addEventListener("click", openReportPanel);
    dom.closeReport.addEventListener("click", closeReportPanel);
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
      state.reportOpen || dom.clientPanel.classList.contains("is-open");

    dom.app.classList.toggle("has-mobile-modal", hasActiveModal);
    dom.modalBackdrop.classList.toggle("is-visible", hasActiveModal);
  }

  function renderReport() {
    if (!dom.reportPanel) return;

    const clients = state.filteredClients || [];
    const total = clients.length;
    const baseTotal = state.clients.length;
    const mapped = clients.filter((client) => client.hasValidCoordinates).length;
    const active = clients.filter(
      (client) => normalizeSearchText(client.situacao) === "ativa"
    ).length;
    const cityEntries = getLocationEntries(clients);
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
      Boolean(state.searchQuery) ||
      Boolean(state.filters.uf) ||
      Boolean(state.filters.municipio) ||
      Boolean(state.filters.situacao);

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
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        }
      });

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
        .order("cnpj", { ascending: true })
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

    const latitude = toNumber(raw.latitude);
    const longitude = toNumber(raw.longitude);
    const cnpj = cleanValue(raw.cnpj);
    const seq = cleanValue(raw.seq);
    const id = cnpj || `${seq || "registro"}-${index}`;

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
    const cnae = cleanValue(raw.cnae);
    const geocodeStatus =
      cleanValue(raw.geocode_status)?.toUpperCase() || "SEM_STATUS";

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
        situacao
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
      cnae,
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

      const statusClass =
        normalizeSearchText(client.situacao) === "ativa" ? "" : "is-inactive";

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
        title: client.displayName
      });

      marker.client = client;
      marker.on("click", (event) => handleMarkerClick(client, event));
      state.markerById.set(client.id, marker);
    }
  }

  function handleMarkerClick(client, event) {
    const group = getCoordinateGroup(client);

    if (group.length <= 1) {
      openClient(client, { focusMap: false });
      return;
    }

    const latlng =
      event?.latlng || L.latLng(client.visualLatitude, client.visualLongitude);
    showPointChoice(group, latlng);
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
      showPointChoice(clients, cluster.getLatLng?.() || cluster.getBounds().getCenter());
      return;
    }

    if (state.map.getZoom() >= state.map.getMaxZoom() - 1) {
      if (event.originalEvent) L.DomEvent.stop(event.originalEvent);
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
      state.map.flyTo(points[0], 16, {
        duration: prefersReducedMotion() ? 0 : 0.45
      });
      return;
    }

    const bounds = L.latLngBounds(points);
    state.map.fitBounds(bounds, {
      paddingTopLeft: [32, 150],
      paddingBottomRight: [32, 52],
      maxZoom: 16,
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
      if (query && !matchesSearchIntent(client, query, searchIntent)) return false;
      return true;
    });

    dom.resultCount.textContent = formatNumber(state.filteredClients.length);

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

    if (fit) fitFilteredClients(searchIntent);
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
    dom.regionReadout.classList.add("is-updating");

    state.regionTimer = window.setTimeout(() => {
      updateRegionReadout();
    }, isMobileViewport() ? 140 : 90);
  }

  function updateRegionReadout() {
    if (!state.map || !dom.regionReadout) return;

    clearTimeout(state.regionTimer);
    dom.regionReadout.classList.remove("is-updating");

    const visibleClients = getVisibleRegionClients();
    const zoom = state.map.getZoom();
    const radius = getCurrentMapRadiusMeters();

    if (!state.clients.length) {
      setRegionReadout({
        level: "Mapa",
        title: "Brasil",
        subtitle: "Carregando leitura da base de clientes..."
      });
      return;
    }

    if (!visibleClients.length) {
      setRegionReadout({
        level: getRegionLevelLabel(zoom),
        title: "Sem clientes na vista",
        subtitle: `Mova o mapa ou reduza o zoom - ${formatDistance(radius)}`
      });
      return;
    }

    const level = getRegionLevel(zoom);
    const context = buildRegionContext(level, visibleClients);
    const countText = `${formatNumber(visibleClients.length)} cliente(s) na vista`;

    setRegionReadout({
      level: context.levelLabel,
      title: context.title,
      subtitle: `${context.subtitle} - ${countText} - ${formatDistance(radius)}`
    });
  }

  function setRegionReadout({ level, title, subtitle }) {
    dom.regionLevel.textContent = level;
    dom.regionTitle.textContent = title;
    dom.regionSubtitle.textContent = subtitle;
  }

  function getVisibleRegionClients() {
    if (!state.map) return [];

    const bounds = state.map.getBounds();
    return state.filteredClients.filter(
      (client) =>
        client.hasValidCoordinates &&
        bounds.contains([client.visualLatitude, client.visualLongitude])
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

  function buildRegionContext(level, clients) {
    if (level === "state") {
      const client = getNearestRegionClient(clients);
      const title = formatStateLabel(client?.uf) || "Brasil";
      const count = clients.filter((item) => item.uf === client?.uf).length;

      return {
        levelLabel: "Estado",
        title,
        subtitle: `${formatNumber(count || clients.length)} cliente(s) nesta area`
      };
    }

    if (level === "city") {
      const client = getNearestRegionClient(clients);
      const title =
        [client?.municipio, client?.uf].filter(Boolean).join(" - ") ||
        "Cidade nao informada";
      const count = clients.filter(
        (item) => item.municipio === client?.municipio && item.uf === client?.uf
      ).length;

      return {
        levelLabel: "Cidade",
        title,
        subtitle: `${formatNumber(count || clients.length)} cliente(s) nesta area`
      };
    }

    if (level === "district") {
      const client =
        getNearestRegionClient(clients, (item) => cleanValue(item.bairro)) ||
        getNearestRegionClient(clients);
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
        subtitle: subtitle || "Area proxima ao centro"
      };
    }

    const nearestStreet = getNearestRegionClient(clients, (client) =>
      cleanValue(client.logradouro)
    );
    const fallback = getNearestRegionClient(clients);
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
      subtitle: subtitle || "Cliente mais proximo do centro"
    };
  }

  function getNearestRegionClient(clients, predicate) {
    if (!state.map || !clients.length) return null;

    const center = state.map.getCenter();
    let nearest = null;
    let nearestDistance = Infinity;

    for (const client of clients) {
      if (predicate && !predicate(client)) continue;

      const distance = state.map.distance(
        center,
        [client.visualLatitude, client.visualLongitude]
      );

      if (distance < nearestDistance) {
        nearest = client;
        nearestDistance = distance;
      }
    }

    return nearest;
  }

  function getCurrentMapRadiusMeters() {
    if (!state.map) return 0;

    const bounds = state.map.getBounds();
    return state.map.distance(state.map.getCenter(), bounds.getNorthEast());
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
    state.searchResultIndex = -1;
    dom.clearSearch.classList.toggle("is-hidden", !state.searchQuery);

    clearTimeout(state.searchTimer);
    state.searchTimer = window.setTimeout(() => {
      applyFilters({ fit: shouldAutoFitSearchQuery(state.searchQuery) });
    }, 170);
  }

  function renderSearchResults() {
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
    state.searchQuery = client.displayName;
    state.searchFocusClientId = client.id;
    state.searchResultIndex = -1;
    state.lastSearchFitKey = "";
    dom.searchInput.value = client.displayName;
    dom.clearSearch.classList.remove("is-hidden");
    hideSearchResults();
    applyFilters({ fit: true });
    openClient(client, { focusMap: false });
  }

  function openClient(client, { focusMap = false, listMode = false } = {}) {
    state.selectedClient = client;
    const coordinateGroup = getCoordinateGroup(client);
    dom.clientPanel.classList.toggle("is-list-mode", listMode);

    const isActive = normalizeSearchText(client.situacao) === "ativa";
    dom.clientStatus.textContent = client.situacao || "Sem situação";
    dom.clientStatus.className = `status-badge ${
      isActive ? "" : "is-inactive"
    }`;

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

    const phones = [client.telefone, client.telefone1]
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
    updateClientActions(client);

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

    const icon = L.divIcon({
      className: "selected-marker-icon",
      html: `<div class="selected-marker" aria-hidden="true"><span class="selected-marker-label">${escapeHtml(shortenLabel(client.displayName, 34))}</span></div>`,
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
      [client.telefone, client.telefone1].filter(Boolean).length
        ? `Telefone: ${[client.telefone, client.telefone1]
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
    if (client?.hasValidCoordinates) {
      const latitude = Number(client.latitude).toFixed(6);
      const longitude = Number(client.longitude).toFixed(6);
      return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    }

    const query = buildAddressQuery(client);
    if (!query) return "";
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
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
    const phone = [client.telefone, client.telefone1]
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

  function formatDistance(meters) {
    const value = Number(meters) || 0;

    if (value >= 100000) {
      return `raio aprox. ${formatNumber(Math.round(value / 1000))} km`;
    }

    if (value >= 1000) {
      return `raio aprox. ${new Intl.NumberFormat("pt-BR", {
        maximumFractionDigits: 1,
        minimumFractionDigits: 0
      }).format(value / 1000)} km`;
    }

    return `raio aprox. ${formatNumber(Math.round(value))} m`;
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

  function isMobileViewport() {
    return (
      window.matchMedia?.("(max-width: 640px), (pointer: coarse)")?.matches ||
      window.innerWidth <= 640
    );
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
