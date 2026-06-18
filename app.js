const STORAGE_KEY = "rmdev-kpi-v1";
const SYNC_KEY = "rmdev-kpi-sync-v1";
const GIST_FILENAME = "rmdev-kpi.json";

const metrics = [
  { id: "revenue", label: "Chiffre d'affaires", helper: "Contrats signés ou factures validées", unit: "EUR", icon: "€", goal: 8000, step: 100 },
  { id: "activeContracts", label: "Missions actives", helper: "Clients ou contrats actuellement en cours", unit: "count", icon: "CO", goal: 4, step: 1, aggregate: "latest" },
  { id: "quotesSent", label: "Devis envoyés", helper: "Propositions envoyées à des prospects", unit: "count", icon: "DV", goal: 12, step: 1 },
  { id: "meetings", label: "Rendez-vous pros", helper: "Appels client, discovery, suivi, vente", unit: "count", icon: "RD", goal: 18, step: 1 },
  { id: "linkedinAdds", label: "Contacts LinkedIn ajoutés", helper: "Nouvelles relations qualifiées", unit: "count", icon: "LI", goal: 80, step: 1 },
  { id: "applications", label: "Candidatures & AO", helper: "Candidatures à des postes, appels d'offres ou missions freelance", unit: "count", icon: "CA", goal: 20, step: 1 },
  { id: "outreach", label: "Prospects contactés", helper: "Messages directs, emails froids, cold outreach", unit: "count", icon: "PR", goal: 60, step: 1 },
  { id: "followUps", label: "Relances", helper: "Suivi de prospects déjà contactés sans réponse", unit: "count", icon: "RL", goal: 30, step: 1 },
  { id: "deepWorkHours", label: "Heures client / création", helper: "Design, dev, stratégie, production livrable", unit: "hours", icon: "HR", goal: 90, step: 0.5 },
  { id: "adminHours", label: "Heures admin", helper: "Gestion, factures, organisation, reporting", unit: "hours", icon: "AD", goal: 20, step: 0.5 },
  { id: "contentPosts", label: "Posts publiés", helper: "LinkedIn, site, cas client, contenu public", unit: "count", icon: "PO", goal: 8, step: 1 },
  { id: "portfolioUpdates", label: "Portfolio amélioré", helper: "Pages, cas client, captures, wording", unit: "count", icon: "PF", goal: 4, step: 1 },
  { id: "projectsDelivered", label: "Projets livrés", helper: "Missions ou livrables finalisés et envoyés au client", unit: "count", icon: "LV", goal: 2, step: 1 },
  { id: "pipelineValue", label: "Opportunités à venir", helper: "Montant potentiel des deals ouverts", unit: "EUR", icon: "OP", goal: 20000, step: 500, aggregate: "latest" }
];

const insightGroups = [
  { label: "Vente", ids: ["quotesSent", "meetings", "outreach", "followUps"], accent: "blue" },
  {
    label: "Revenus", ids: ["revenue", "activeContracts", "pipelineValue"], accent: "green",
    derived: (entries) => {
      const rev = sumMetric(entries, "revenue");
      const hours = sumMetric(entries, "deepWorkHours");
      if (hours === 0) return null;
      return `Taux horaire : <strong>${formatValue(Math.round(rev / hours), "EUR")}/h</strong>`;
    }
  },
  { label: "Production", ids: ["deepWorkHours", "adminHours", "portfolioUpdates", "projectsDelivered"], accent: "amber" },
  { label: "Visibilité", ids: ["linkedinAdds", "applications", "contentPosts"], accent: "red" }
];

const state = loadState();
let demoEntries = null;

const syncConfig = (() => {
  try { return JSON.parse(localStorage.getItem(SYNC_KEY)) || {}; } catch { return {}; }
})();
let syncPhase = { status: "idle", lastSync: null, error: null };

const elements = {
  navTabs: document.querySelectorAll(".nav-tab"),
  viewTitle: document.querySelector("#view-title"),
  currentPeriod: document.querySelector("#current-period"),
  demoState: document.querySelector("#demo-state"),
  insightGrid: document.querySelector("#insight-grid"),
  quickDate: document.querySelector("#quick-date"),
  quickFields: document.querySelector("#quick-fields"),
  todayStatus: document.querySelector("#today-status"),
  entryForm: document.querySelector("#entry-form"),
  entryDate: document.querySelector("#entry-date"),
  entryFields: document.querySelector("#entry-fields"),
  goalFields: document.querySelector("#goal-fields"),
  goalsForm: document.querySelector("#goals-form"),
  goalList: document.querySelector("#goal-list"),
  goalCount: document.querySelector("#goal-count"),
  weeklyBars: document.querySelector("#weekly-bars"),
  weekTotal: document.querySelector("#week-total"),
  historyList: document.querySelector("#history-list"),
  historyCount: document.querySelector("#history-count"),
  storageStatus: document.querySelector("#storage-status"),
  exportData: document.querySelector("#export-data"),
  importData: document.querySelector("#import-data"),
  clearData: document.querySelector("#clear-data"),
  seedDemo: document.querySelector("#seed-demo"),
  funnelSteps: document.querySelector("#funnel-steps"),
  funnelMonth: document.querySelector("#funnel-month")
};

function loadState() {
  const fallback = {
    entries: [],
    goals: Object.fromEntries(metrics.map((metric) => [metric.id, metric.goal]))
  };

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || !Array.isArray(saved.entries)) return fallback;
    return {
      entries: mergeEntriesByDate(saved.entries),
      goals: { ...fallback.goals, ...(saved.goals || {}) }
    };
  } catch {
    return fallback;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  demoEntries = null;
  render();
  pushToGist();
}

function currentMonthKey() {
  return getLocalDateValue(new Date()).slice(0, 7);
}

function getLocalDateValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getMonthEntries() {
  const month = currentMonthKey();
  return getVisibleEntries().filter((entry) => entry.date.startsWith(month));
}

function getVisibleEntries() {
  return demoEntries || state.entries;
}

function sumMetric(entries, metricId) {
  return entries.reduce((total, entry) => total + Number(entry.values?.[metricId] || 0), 0);
}

function mergeEntriesByDate(entries) {
  const merged = new Map();
  entries.forEach((entry) => {
    if (!merged.has(entry.date)) {
      merged.set(entry.date, { ...entry, values: { ...createEmptyValues(), ...(entry.values || {}) } });
      return;
    }

    const current = merged.get(entry.date);
    metrics.forEach((metric) => {
      const currentValue = Number(current.values?.[metric.id] || 0);
      const nextValue = Number(entry.values?.[metric.id] || 0);
      current.values[metric.id] = metric.aggregate === "latest" ? nextValue || currentValue : currentValue + nextValue;
    });
    current.notes = [current.notes, entry.notes].filter(Boolean).join("\n");
    current.updatedAt = entry.updatedAt || entry.createdAt || current.updatedAt;
  });
  return [...merged.values()];
}

function getMetricValue(entries, metric) {
  if (metric.aggregate !== "latest") return sumMetric(entries, metric.id);
  const sortedEntries = [...entries]
    .filter((entry) => Number(entry.values?.[metric.id] || 0) > 0)
    .sort((a, b) => b.date.localeCompare(a.date));
  return Number(sortedEntries[0]?.values?.[metric.id] || 0);
}

function createEmptyValues() {
  return Object.fromEntries(metrics.map((metric) => [metric.id, 0]));
}

function findEntryByDate(date, entries = getVisibleEntries()) {
  return entries.find((entry) => entry.date === date);
}

function getEntryValues(date) {
  return { ...createEmptyValues(), ...(findEntryByDate(date)?.values || {}) };
}

function formatValue(value, unit) {
  if (unit === "EUR") {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0
    }).format(value);
  }

  if (unit === "hours") return `${formatNumber(value, 1)} h`;
  return formatNumber(value, 0);
}

function formatNumber(value, maximumFractionDigits = 0) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits }).format(value);
}

function formatDate(dateValue) {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "short"
  }).format(new Date(`${dateValue}T12:00:00`));
}

function renderEntryFields() {
  elements.entryFields.innerHTML = metrics.map((metric) => `
    <div class="form-row metric-input">
      <label for="entry-${metric.id}">
        ${metric.label}
        <span>${metric.helper}</span>
      </label>
      <div class="stepper">
        <button class="step-button" type="button" data-step-target="entry-${metric.id}" data-step-value="-${metric.step}" aria-label="Retirer ${metric.step}">−</button>
        <input id="entry-${metric.id}" name="${metric.id}" type="number" min="0" step="${metric.step}" value="0" inputmode="decimal">
        <button class="step-button" type="button" data-step-target="entry-${metric.id}" data-step-value="${metric.step}" aria-label="Ajouter ${metric.step}">+</button>
      </div>
    </div>
  `).join("");

  elements.goalFields.innerHTML = metrics.map((metric) => `
    <div class="form-row metric-input">
      <label for="goal-${metric.id}">
        ${metric.label}
        <span>${metric.helper}</span>
      </label>
      <div class="stepper">
        <button class="step-button" type="button" data-step-target="goal-${metric.id}" data-step-value="-${metric.step}" aria-label="Retirer ${metric.step}">−</button>
        <input id="goal-${metric.id}" name="${metric.id}" type="number" min="0" step="${metric.step}" value="${state.goals[metric.id] || 0}" inputmode="decimal">
        <button class="step-button" type="button" data-step-target="goal-${metric.id}" data-step-value="${metric.step}" aria-label="Ajouter ${metric.step}">+</button>
      </div>
    </div>
  `).join("");
}

function renderQuickFields() {
  const selectedDate = elements.quickDate.value || getLocalDateValue(new Date());
  const values = getEntryValues(selectedDate);
  const entry = findEntryByDate(selectedDate);

  elements.todayStatus.textContent = entry ? "Journée déjà enregistrée" : "Nouvelle journée";
  elements.quickFields.innerHTML = metrics.map((metric) => `
    <div class="quick-field">
      <div>
        <strong>${metric.label}</strong>
        <span>${formatValue(values[metric.id] || 0, metric.unit)}</span>
      </div>
      <div class="quick-stepper">
        <button class="step-button" type="button" data-quick-metric="${metric.id}" data-step-value="-${metric.step}" aria-label="Retirer ${metric.step}">−</button>
        <input id="quick-${metric.id}" data-quick-input="${metric.id}" type="number" min="0" step="${metric.step}" value="${values[metric.id] || 0}" inputmode="decimal" aria-label="${metric.label}">
        <button class="step-button" type="button" data-quick-metric="${metric.id}" data-step-value="${metric.step}" aria-label="Ajouter ${metric.step}">+</button>
      </div>
    </div>
  `).join("");
}

function renderInsights() {
  const monthEntries = getMonthEntries();
  elements.insightGrid.innerHTML = insightGroups.map((group) => {
    const score = group.ids.reduce((total, metricId) => {
      const goal = Number(state.goals[metricId] || 0);
      if (goal === 0) return total;
      const metric = metrics.find((item) => item.id === metricId);
      return total + Math.min(getMetricValue(monthEntries, metric) / goal, 1);
    }, 0);
    const percent = Math.round((score / group.ids.length) * 100);
    const details = group.ids.map((metricId) => {
      const metric = metrics.find((item) => item.id === metricId);
      return `<span>${metric.label}: <strong>${formatValue(getMetricValue(monthEntries, metric), metric.unit)}</strong></span>`;
    }).join("");
    const derivedDetail = group.derived ? group.derived(monthEntries) : null;

    return `
      <article class="insight-card ${group.accent}">
        <div>
          <p>${group.label}</p>
          <strong>${percent}%</strong>
        </div>
        <div class="mini-progress" aria-hidden="true">
          <span style="width: ${percent}%"></span>
        </div>
        <div class="insight-details">${details}${derivedDetail ? `<span>${derivedDetail}</span>` : ""}</div>
      </article>
    `;
  }).join("");
}

function renderGoals() {
  const monthEntries = getMonthEntries();
  const importantMetricIds = ["revenue", "quotesSent", "meetings", "outreach", "followUps", "deepWorkHours", "pipelineValue"];
  const rows = metrics.filter((metric) => importantMetricIds.includes(metric.id)).map((metric) => {
    const value = getMetricValue(monthEntries, metric);
    const goal = Number(state.goals[metric.id] || 0);
    const percent = goal > 0 ? Math.min((value / goal) * 100, 100) : 0;
    return `
      <div class="goal-row">
        <div class="goal-row-info">
          <strong>${metric.label}</strong>
          <span>${formatValue(value, metric.unit)} / ${formatValue(goal, metric.unit)}</span>
        </div>
        <div class="progress-track" aria-hidden="true">
          <div class="progress-fill" style="width: ${percent}%"></div>
        </div>
      </div>
    `;
  });

  elements.goalList.innerHTML = rows.join("");
  elements.goalCount.textContent = `${monthEntries.length} jour(s) saisi(s)`;
}

function renderWeeklyBars() {
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    return getLocalDateValue(date);
  });

  const dailyScores = days.map((date) => {
    const entries = getVisibleEntries().filter((entry) => entry.date === date);
    return {
      date,
      score: sumMetric(entries, "meetings") + sumMetric(entries, "quotesSent") + sumMetric(entries, "outreach") + sumMetric(entries, "followUps") + sumMetric(entries, "deepWorkHours")
    };
  });
  const maxScore = Math.max(...dailyScores.map((day) => day.score), 1);

  elements.weeklyBars.innerHTML = dailyScores.map((day) => `
    <div class="bar-row">
      <span>${formatDate(day.date)}</span>
      <div class="bar-track" aria-hidden="true">
        <div class="bar-fill" style="width: ${(day.score / maxScore) * 100}%"></div>
      </div>
      <strong>${formatNumber(day.score, 1)}</strong>
    </div>
  `).join("");
  elements.weekTotal.textContent = `${formatNumber(dailyScores.reduce((total, day) => total + day.score, 0), 1)} points`;
}

function renderHistory() {
  const sortedEntries = [...getVisibleEntries()].sort((a, b) => b.date.localeCompare(a.date));
  elements.historyCount.textContent = `${sortedEntries.length} entrée(s)`;

  if (sortedEntries.length === 0) {
    elements.historyList.innerHTML = `<p class="empty-state">Aucune saisie pour le moment.</p>`;
    return;
  }

  elements.historyList.innerHTML = sortedEntries.map((entry) => {
    const activeMetrics = metrics
      .filter((metric) => Number(entry.values?.[metric.id] || 0) > 0)
      .map((metric) => `<span class="pill">${metric.label}: ${formatValue(Number(entry.values[metric.id]), metric.unit)}</span>`)
      .join("");

    return `
      <article class="history-entry">
        <div class="history-entry-top">
          <h4>${formatDate(entry.date)}</h4>
          <div class="history-actions">
            <button class="edit-entry" type="button" data-edit-entry="${entry.date}">Modifier</button>
            <button class="delete-entry" type="button" data-delete-entry="${entry.id}">Supprimer</button>
          </div>
        </div>
        <div class="history-metrics">${activeMetrics || `<span class="muted">Aucun KPI positif</span>`}</div>
        ${entry.notes ? `<p class="muted">${escapeHtml(entry.notes)}</p>` : ""}
      </article>
    `;
  }).join("");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderSettings() {
  const bytes = new Blob([JSON.stringify(state)]).size;
  elements.storageStatus.textContent = `${Math.round(bytes / 1024)} Ko stockés`;
}

function renderPeriod() {
  const now = new Date();
  elements.currentPeriod.textContent = new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric"
  }).format(now);
}

// ── Sync GitHub Gist ──────────────────────────────────────────

function persistSyncConfig() {
  localStorage.setItem(SYNC_KEY, JSON.stringify(syncConfig));
}

function mergeRemoteLocal(remoteEntries, localEntries) {
  const byDate = new Map();
  [...remoteEntries, ...localEntries].forEach((entry) => {
    const existing = byDate.get(entry.date);
    if (!existing) {
      byDate.set(entry.date, { ...entry, values: { ...createEmptyValues(), ...entry.values } });
      return;
    }
    const tExisting = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
    const tEntry = new Date(entry.updatedAt || entry.createdAt || 0).getTime();
    if (tEntry >= tExisting) {
      byDate.set(entry.date, { ...entry, values: { ...createEmptyValues(), ...entry.values } });
    }
  });
  return [...byDate.values()];
}

async function gistFetch(method, path, body) {
  const res = await fetch(`https://api.github.com/gists${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${syncConfig.token}`,
      "Content-Type": "application/json",
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });
  if (!res.ok) throw new Error(`GitHub ${res.status}`);
  return res.json();
}

async function pushToGist() {
  if (!syncConfig.token) return;
  setSyncPhase("syncing");
  try {
    const files = { [GIST_FILENAME]: { content: JSON.stringify(state, null, 2) } };
    if (!syncConfig.gistId) {
      const gist = await gistFetch("POST", "", {
        description: "KPI RM Dev Design — sync auto",
        public: false,
        files
      });
      syncConfig.gistId = gist.id;
      persistSyncConfig();
      renderSyncSettings();
    } else {
      await gistFetch("PATCH", `/${syncConfig.gistId}`, { files });
    }
    setSyncPhase("ok");
  } catch (err) {
    setSyncPhase("error", err.message);
  }
}

async function pullFromGist() {
  if (!syncConfig.token || !syncConfig.gistId) return;
  setSyncPhase("syncing");
  try {
    const gist = await gistFetch("GET", `/${syncConfig.gistId}`);
    const raw = gist.files[GIST_FILENAME]?.content;
    if (!raw) throw new Error("Fichier introuvable dans le Gist");
    const remote = JSON.parse(raw);
    if (!Array.isArray(remote.entries)) throw new Error("Format invalide");
    state.entries = mergeRemoteLocal(remote.entries, state.entries);
    state.goals = { ...remote.goals, ...state.goals };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    demoEntries = null;
    render();
    setSyncPhase("ok");
  } catch (err) {
    setSyncPhase("error", err.message);
  }
}

function setSyncPhase(status, error = null) {
  syncPhase = { status, error, lastSync: status === "ok" ? new Date() : syncPhase.lastSync };
  renderSyncIndicator();
  renderSyncStatusBadge();
}

function renderSyncIndicator() {
  const el = document.querySelector("#sync-indicator");
  if (!el) return;
  if (!syncConfig.token) { el.hidden = true; return; }
  el.hidden = false;
  const labels = { syncing: "Sync…", ok: null, error: "Erreur sync", idle: "" };
  if (syncPhase.status === "ok" && syncPhase.lastSync) {
    el.textContent = `Sync ${new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(syncPhase.lastSync)}`;
  } else {
    el.textContent = labels[syncPhase.status] || "";
  }
  el.className = `sync-indicator is-${syncPhase.status}`;
  el.title = syncPhase.error || "";
}

function renderSyncStatusBadge() {
  const el = document.querySelector("#sync-status-badge");
  if (!el) return;
  const labels = { syncing: "En cours…", ok: "Connecté", error: syncPhase.error || "Erreur", idle: "" };
  el.textContent = labels[syncPhase.status] || "";
}

function renderSyncSettings() {
  const setup = document.querySelector("#sync-setup");
  const connected = document.querySelector("#sync-connected");
  const display = document.querySelector("#sync-gist-display");
  if (!setup || !connected) return;
  const isConnected = !!syncConfig.token;
  setup.hidden = isConnected;
  connected.hidden = !isConnected;
  if (isConnected && display) display.textContent = syncConfig.gistId || "—";
}

// ──────────────────────────────────────────────────────────────

function renderFunnel() {
  const monthEntries = getMonthEntries();
  const funnelConfig = [
    { metricId: "linkedinAdds", label: "Contacts ajoutés" },
    { metricId: "outreach",     label: "Messages envoyés" },
    { metricId: "followUps",    label: "Relances" },
    { metricId: "meetings",     label: "RDV" },
    { metricId: "quotesSent",   label: "Devis" },
    { metricId: "activeContracts", label: "Missions actives" }
  ];

  const steps = funnelConfig.map(({ metricId, label }) => {
    const metric = metrics.find((m) => m.id === metricId);
    return { label, value: getMetricValue(monthEntries, metric) };
  });

  const maxValue = Math.max(...steps.map((s) => s.value), 1);

  elements.funnelSteps.innerHTML = steps.map((step, index) => {
    const prev = steps[index - 1];
    let rateHtml;

    if (!prev) {
      rateHtml = `<span class="funnel-step-rate">Point d'entrée</span>`;
    } else if (prev.value === 0) {
      rateHtml = `<span class="funnel-step-rate">—</span>`;
    } else {
      const rate = Math.round((step.value / prev.value) * 100);
      const cls = rate >= 50 ? "is-good" : rate >= 25 ? "is-ok" : "is-low";
      rateHtml = `<span class="funnel-step-rate ${cls}">${rate}% conv.</span>`;
    }

    const barWidth = Math.max((step.value / maxValue) * 100, 0);
    return `
      <div class="funnel-step">
        <span class="funnel-step-label">${step.label}</span>
        <strong class="funnel-step-value">${formatNumber(step.value, 0)}</strong>
        ${rateHtml}
        <div class="funnel-bar"><div class="funnel-bar-fill" style="width:${barWidth}%"></div></div>
      </div>
    `;
  }).join("");

  elements.funnelMonth.textContent = `${monthEntries.length} jour(s) saisi(s)`;
}

function render() {
  renderPeriod();
  elements.demoState.hidden = !demoEntries;
  elements.seedDemo.textContent = demoEntries ? "Masquer l'exemple" : "Voir un exemple";
  renderQuickFields();
  renderInsights();
  renderFunnel();
  renderGoals();
  renderWeeklyBars();
  renderHistory();
  renderSettings();
}

function setView(viewName) {
  document.querySelectorAll(".view").forEach((view) => view.classList.remove("is-visible"));
  document.querySelector(`#${viewName}-view`).classList.add("is-visible");
  elements.navTabs.forEach((tab) => tab.classList.toggle("is-active", tab.dataset.view === viewName));
  elements.viewTitle.textContent = {
    dashboard: "Dashboard",
    entry: "Saisie journalière",
    history: "Historique",
    goals: "Objectifs",
    settings: "Données"
  }[viewName];
}

function upsertEntry(date, values, notes = "") {
  const entries = demoEntries || state.entries;
  const existingEntry = findEntryByDate(date, entries);

  if (existingEntry) {
    existingEntry.values = { ...createEmptyValues(), ...existingEntry.values, ...values };
    existingEntry.notes = notes;
    existingEntry.updatedAt = new Date().toISOString();
  } else {
    entries.push({
      id: crypto.randomUUID(),
      date,
      values: { ...createEmptyValues(), ...values },
      notes,
      createdAt: new Date().toISOString()
    });
  }

  if (demoEntries) {
    render();
  } else {
    saveState();
  }
}

function addEntry(formData) {
  const values = Object.fromEntries(metrics.map((metric) => [metric.id, normalizeValue(formData.get(metric.id), metric)]));
  upsertEntry(formData.get("date"), values, formData.get("notes").trim());
}

function updateQuickMetric(metricId, rawValue) {
  const metric = metrics.find((item) => item.id === metricId);
  const date = elements.quickDate.value || getLocalDateValue(new Date());
  const values = getEntryValues(date);
  values[metricId] = normalizeValue(rawValue, metric);
  upsertEntry(date, values, findEntryByDate(date)?.notes || "");
}

function populateEntryForm(date) {
  const entry = findEntryByDate(date);
  const values = getEntryValues(date);
  elements.entryDate.value = date;
  metrics.forEach((metric) => {
    const input = document.querySelector(`#entry-${metric.id}`);
    if (input) input.value = values[metric.id] || 0;
  });
  document.querySelector("#entry-notes").value = entry?.notes || "";
}

function normalizeValue(value, metric) {
  const parsed = Number(value || 0);
  if (metric.unit === "hours") return Math.max(0, Math.round(parsed * 2) / 2);
  return Math.max(0, Math.round(parsed));
}

function seedDemoData() {
  const today = new Date();
  const examples = Array.from({ length: 14 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - index);
    return {
      id: crypto.randomUUID(),
      date: getLocalDateValue(date),
      values: {
        revenue: index % 5 === 0 ? 1800 : 0,
        activeContracts: index % 6 === 0 ? 1 : 0,
        quotesSent: index % 3 === 0 ? 2 : 0,
        meetings: 1 + (index % 3),
        linkedinAdds: 4 + index,
        applications: index % 4 === 0 ? 2 : 0,
        outreach: 3 + (index % 5),
        followUps: 2 + (index % 4),
        deepWorkHours: 3 + (index % 4),
        adminHours: index % 2,
        contentPosts: index % 6 === 0 ? 1 : 0,
        portfolioUpdates: index % 8 === 0 ? 1 : 0,
        projectsDelivered: index % 7 === 0 ? 1 : 0,
        pipelineValue: index % 4 === 0 ? 2500 : 0
      },
      notes: index === 0 ? "Exemple de journée active." : "",
      createdAt: new Date().toISOString()
    };
  });

  demoEntries = demoEntries ? null : examples;
  render();
}

function downloadJson() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `rmdev-kpi-${getLocalDateValue(new Date())}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function importJson(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const nextState = JSON.parse(reader.result);
      if (!Array.isArray(nextState.entries) || typeof nextState.goals !== "object") {
        throw new Error("Invalid shape");
      }
      state.entries = nextState.entries;
      state.goals = { ...state.goals, ...nextState.goals };
      saveState();
    } catch {
      alert("Le fichier JSON ne correspond pas au format attendu.");
    }
  };
  reader.readAsText(file);
}

elements.navTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    if (tab.dataset.view === "entry") {
      populateEntryForm(elements.quickDate.value || getLocalDateValue(new Date()));
    }
    setView(tab.dataset.view);
  });
});

document.querySelectorAll("[data-view-shortcut]").forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.viewShortcut === "entry") {
      populateEntryForm(elements.quickDate.value || getLocalDateValue(new Date()));
    }
    setView(button.dataset.viewShortcut);
  });
});

elements.entryForm.addEventListener("submit", (event) => {
  event.preventDefault();
  addEntry(new FormData(elements.entryForm));
  elements.entryForm.reset();
  elements.entryDate.value = getLocalDateValue(new Date());
  setView("dashboard");
});

elements.entryDate.addEventListener("change", () => {
  populateEntryForm(elements.entryDate.value);
});

elements.goalsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(elements.goalsForm);
  metrics.forEach((metric) => {
    state.goals[metric.id] = normalizeValue(formData.get(metric.id), metric);
  });
  saveState();
  setView("dashboard");
});

elements.historyList.addEventListener("click", (event) => {
  const editDate = event.target.dataset.editEntry;
  if (editDate) {
    populateEntryForm(editDate);
    setView("entry");
    return;
  }

  const deleteId = event.target.dataset.deleteEntry;
  if (!deleteId) return;
  if (demoEntries) {
    demoEntries = demoEntries.filter((entry) => entry.id !== deleteId);
    render();
    return;
  }
  state.entries = state.entries.filter((entry) => entry.id !== deleteId);
  saveState();
});

document.addEventListener("click", (event) => {
  const button = event.target.closest(".step-button");
  if (!button) return;

  const quickMetricId = button.dataset.quickMetric;
  if (quickMetricId) {
    const currentValue = getEntryValues(elements.quickDate.value)[quickMetricId] || 0;
    updateQuickMetric(quickMetricId, currentValue + Number(button.dataset.stepValue || 0));
    return;
  }

  const input = document.querySelector(`#${button.dataset.stepTarget}`);
  const metric = metrics.find((item) => button.dataset.stepTarget.endsWith(item.id));
  const nextValue = Number(input.value || 0) + Number(button.dataset.stepValue || 0);
  input.value = normalizeValue(nextValue, metric);
  input.dispatchEvent(new Event("input", { bubbles: true }));
});

elements.quickDate.addEventListener("change", renderQuickFields);

elements.quickFields.addEventListener("change", (event) => {
  const metricId = event.target.dataset.quickInput;
  if (!metricId) return;
  updateQuickMetric(metricId, event.target.value);
});

elements.exportData.addEventListener("click", downloadJson);
elements.importData.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (file) importJson(file);
  event.target.value = "";
});

elements.clearData.addEventListener("click", () => {
  if (!confirm("Effacer toutes les données KPI locales ?")) return;
  state.entries = [];
  saveState();
});

elements.seedDemo.addEventListener("click", seedDemoData);

document.querySelector("#sync-connect").addEventListener("click", () => {
  const token = document.querySelector("#sync-token").value.trim();
  const gistId = document.querySelector("#sync-gist-input").value.trim();
  if (!token) return;
  syncConfig.token = token;
  if (gistId) syncConfig.gistId = gistId;
  persistSyncConfig();
  renderSyncSettings();
  gistId ? pullFromGist() : pushToGist();
});

document.querySelector("#sync-pull-btn").addEventListener("click", pullFromGist);
document.querySelector("#sync-push-btn").addEventListener("click", pushToGist);

document.querySelector("#sync-disconnect-btn").addEventListener("click", () => {
  if (!confirm("Déconnecter la sync Gist ? Les données locales sont conservées.")) return;
  syncConfig.token = null;
  syncConfig.gistId = null;
  persistSyncConfig();
  renderSyncSettings();
  renderSyncIndicator();
});

elements.entryDate.value = getLocalDateValue(new Date());
elements.quickDate.value = getLocalDateValue(new Date());
renderEntryFields();
render();
renderSyncSettings();
renderSyncIndicator();
if (syncConfig.token && syncConfig.gistId) pullFromGist();
