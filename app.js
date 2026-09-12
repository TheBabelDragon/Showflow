const STORAGE_KEY = "showflow-day-v1";

const state = {
  dayLabel: "Saturday Floor",
  workers: [],
  shows: [],
  result: null
};

function uid(prefix) {
  return prefix + "-" + Math.random().toString(36).slice(2, 7);
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.workers) || !Array.isArray(parsed.shows)) return false;
    state.dayLabel = parsed.dayLabel || "Day";
    state.workers = parsed.workers;
    state.shows = parsed.shows;
    return true;
  } catch (error) {
    return false;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    dayLabel: state.dayLabel,
    workers: state.workers,
    shows: state.shows
  }));
}

function loadSample() {
  const sample = sampleDay();
  state.dayLabel = sample.dayLabel;
  state.workers = sample.workers;
  state.shows = sample.shows;
  state.result = null;
  saveState();
  render();
}

function el(html) {
  const template = document.createElement("template");
  template.innerHTML = html.trim();
  return template.content.firstElementChild;
}

function renderWorkers() {
  const root = document.getElementById("workers");
  root.innerHTML = "";
  if (state.workers.length === 0) {
    root.appendChild(el('<div class="empty">No workers yet.</div>'));
    return;
  }
  state.workers.forEach((worker, index) => {
    const card = el(`
      <div class="card">
        <div class="card-head">
          <strong>${escapeHtml(worker.name || "Unnamed")}</strong>
          <button data-remove-worker="${index}">Remove</button>
        </div>
        <div class="row">
          <label class="field"><span>ID</span><input data-w="${index}" data-k="id" value="${escapeAttr(worker.id)}"></label>
          <label class="field grow"><span>Name</span><input data-w="${index}" data-k="name" value="${escapeAttr(worker.name)}"></label>
        </div>
        <div class="avail" data-avail="${index}"></div>
        <div class="transport">
          <button data-add-avail="${index}">Add availability window</button>
        </div>
      </div>
    `);
    const avail = card.querySelector(".avail");
    (worker.availability || []).forEach((window, wIndex) => {
      avail.appendChild(el(`
        <div class="row" style="margin-top:8px">
          <label class="field"><span>Available from</span><input type="time" data-w="${index}" data-a="${wIndex}" data-k="start" value="${escapeAttr(window.start)}"></label>
          <label class="field"><span>Available to</span><input type="time" data-w="${index}" data-a="${wIndex}" data-k="end" value="${escapeAttr(window.end)}"></label>
          <button data-remove-avail="${index}:${wIndex}">×</button>
        </div>
      `));
    });
    if (!worker.availability || worker.availability.length === 0) {
      avail.appendChild(el('<div class="muted" style="margin-top:8px">No windows = available all day</div>'));
    }
    root.appendChild(card);
  });
}

function renderShows() {
  const root = document.getElementById("shows");
  root.innerHTML = "";
  if (state.shows.length === 0) {
    root.appendChild(el('<div class="empty">No shows yet.</div>'));
    return;
  }
  state.shows.forEach((show, index) => {
    const required = workersRequired(Number(show.guests) || 0);
    const card = el(`
      <div class="card">
        <div class="card-head">
          <strong>${escapeHtml(show.name || "Untitled show")}</strong>
          <button data-remove-show="${index}">Remove</button>
        </div>
        <div class="row">
          <label class="field"><span>ID</span><input data-s="${index}" data-k="id" value="${escapeAttr(show.id)}"></label>
          <label class="field grow"><span>Name</span><input data-s="${index}" data-k="name" value="${escapeAttr(show.name)}"></label>
          <label class="field"><span>Guests</span><input type="number" min="0" data-s="${index}" data-k="guests" value="${escapeAttr(show.guests)}"></label>
        </div>
        <div class="muted" style="margin-top:8px">${required} worker${required === 1 ? "" : "s"} per concrete set</div>
        <div class="sets" data-sets="${index}"></div>
        <div class="transport">
          <button data-add-set="${index}">Add A/B/C set time</button>
        </div>
      </div>
    `);
    const sets = card.querySelector(".sets");
    (show.setTimes || []).forEach((setTime, setIndex) => {
      const range = rangeFromType(setTime.start, setTime.type);
      sets.appendChild(el(`
        <div class="row" style="margin-top:8px">
          <label class="field"><span>Set ID</span><input data-s="${index}" data-t="${setIndex}" data-k="id" value="${escapeAttr(setTime.id)}"></label>
          <label class="field"><span>Type</span>
            <select data-s="${index}" data-t="${setIndex}" data-k="type">
              <option value="A" ${setTime.type === "A" ? "selected" : ""}>A · 30m protected</option>
              <option value="B" ${setTime.type === "B" ? "selected" : ""}>B · 60m / 30m overlap</option>
              <option value="C" ${setTime.type === "C" ? "selected" : ""}>C · 60m warn overlap</option>
            </select>
          </label>
          <label class="field"><span>Start</span><input type="time" data-s="${index}" data-t="${setIndex}" data-k="start" value="${escapeAttr(setTime.start)}"></label>
          <button data-remove-set="${index}:${setIndex}">×</button>
        </div>
      `));
      if (range) {
        sets.appendChild(el(`<div class="chip-row"><span class="chip ${String(setTime.type).toLowerCase()}">${setTime.type} ${rangeLabel(range)}</span></div>`));
      }
    });
    root.appendChild(card);
  });
}

function renderResult() {
  const root = document.getElementById("result");
  if (!state.result) {
    root.innerHTML = '<div class="empty">Solve to produce assignments, coverage, warnings, and the master day sheet.</div>';
    return;
  }
  const result = state.result;
  const workerById = Object.fromEntries(state.workers.map((worker) => [worker.id, worker]));
  const showById = Object.fromEntries(state.shows.map((show) => [show.id, show]));

  const coverageRows = state.shows.flatMap((show) => {
    const required = workersRequired(show.guests);
    return show.setTimes.map((setTime) => {
      const assigned = new Set(
        result.assignments
          .filter((slot) => slot.showId === show.id && slot.setTimeId === setTime.id)
          .map((slot) => slot.workerId)
      ).size;
      const cls = assigned >= required ? "ok" : "bad";
      return `<tr>
        <td>${escapeHtml(show.name)}</td>
        <td>${escapeHtml(setTime.id)}</td>
        <td>${escapeHtml(setTime.type)} ${escapeHtml(rangeLabel(rangeFromType(setTime.start, setTime.type)))}</td>
        <td class="${cls}">${assigned}/${required}</td>
      </tr>`;
    });
  }).join("");

  const assignmentRows = result.assignments.map((slot) => {
    const worker = workerById[slot.workerId];
    const show = showById[slot.showId];
    return `<tr>
      <td>${escapeHtml(worker ? worker.name : slot.workerId)}</td>
      <td>${escapeHtml(show ? show.name : slot.showId)}</td>
      <td>${escapeHtml(slotType(slot))}</td>
      <td>${escapeHtml(rangeLabel(slotRange(slot)))}</td>
      <td>${slot.coverageSlot}</td>
      <td class="${slot.warnings.length ? "warn-text" : "ok"}">${slot.warnings.length ? slot.warnings.length + " warning(s)" : "ok"}</td>
    </tr>`;
  }).join("");

  const gapRows = result.coverageGaps.length
    ? result.coverageGaps.map((gap) => {
      const show = showById[gap.showId];
      return `<tr><td>${escapeHtml(show ? show.name : gap.showId)}</td><td>${escapeHtml(gap.setTimeId)}</td><td class="bad">missing ${gap.missing}</td></tr>`;
    }).join("")
    : '<tr><td colspan="3" class="ok">NONE</td></tr>';

  const warningRows = result.warnings.length
    ? result.warnings.map((warning) => {
      const worker = workerById[warning.workerId];
      return `<tr>
        <td>${escapeHtml(worker ? worker.name : warning.workerId)}</td>
        <td>${escapeHtml(warning.existingAssignmentId)} → ${escapeHtml(warning.newAssignmentId)}</td>
        <td class="warn-text">${escapeHtml(warning.message)} (${warning.overlapMinutes} min)</td>
      </tr>`;
    }).join("")
    : '<tr><td colspan="3" class="ok">NONE</td></tr>';

  const workerSheets = state.workers.map((worker) => {
    return `<details class="sheet"><summary>${escapeHtml(worker.name)} schedule</summary><pre>${escapeHtml(generateWorkerSheet(worker, state.shows, result))}</pre></details>`;
  }).join("");

  root.innerHTML = `
    <div class="stats">
      <div class="stat"><div class="k">Assignments</div><div class="v">${result.assignmentCount}</div></div>
      <div class="stat"><div class="k">Coverage gaps</div><div class="v ${result.gapCount ? "bad" : ""}">${result.gapCount}</div></div>
      <div class="stat"><div class="k">Warnings</div><div class="v ${result.warnings.length ? "warn" : ""}">${result.warnings.length}</div></div>
      <div class="stat"><div class="k">Fully covered</div><div class="v ${result.fullyCovered ? "" : "bad"}">${result.fullyCovered}</div></div>
    </div>
    <h3 class="muted" style="margin:16px 0 8px">COVERAGE</h3>
    <div class="table-wrap"><table><thead><tr><th>Show</th><th>Set</th><th>Window</th><th>Staff</th></tr></thead><tbody>${coverageRows || '<tr><td colspan="4">None</td></tr>'}</tbody></table></div>
    <h3 class="muted" style="margin:16px 0 8px">ASSIGNMENTS</h3>
    <div class="table-wrap"><table><thead><tr><th>Worker</th><th>Show</th><th>Type</th><th>Time</th><th>Slot</th><th>Flags</th></tr></thead><tbody>${assignmentRows || '<tr><td colspan="6">None</td></tr>'}</tbody></table></div>
    <h3 class="muted" style="margin:16px 0 8px">GAPS</h3>
    <div class="table-wrap"><table><thead><tr><th>Show</th><th>Set</th><th>Missing</th></tr></thead><tbody>${gapRows}</tbody></table></div>
    <h3 class="muted" style="margin:16px 0 8px">WARNINGS</h3>
    <div class="table-wrap"><table><thead><tr><th>Worker</th><th>Sets</th><th>Message</th></tr></thead><tbody>${warningRows}</tbody></table></div>
    <h3 class="muted" style="margin:16px 0 8px">MASTER DAY SHEET</h3>
    <textarea id="day-sheet" readonly>${escapeHtml(generateDaySheet(state.dayLabel, state.workers, state.shows, result))}</textarea>
    ${workerSheets}
  `;
}

function render() {
  document.getElementById("day-label").value = state.dayLabel;
  renderWorkers();
  renderShows();
  renderResult();
}

function runSolve() {
  state.result = solve(state.workers, state.shows);
  saveState();
  render();
  document.getElementById("result-panel").scrollIntoView({ behavior: "smooth", block: "start" });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/"/g, "&quot;");
}

document.addEventListener("input", (event) => {
  const target = event.target;
  if (target.id === "day-label") {
    state.dayLabel = target.value;
    saveState();
    return;
  }
  if (target.dataset.w != null && target.dataset.a == null) {
    state.workers[Number(target.dataset.w)][target.dataset.k] = target.dataset.k === "guests" ? Number(target.value) : target.value;
    saveState();
    return;
  }
  if (target.dataset.w != null && target.dataset.a != null) {
    state.workers[Number(target.dataset.w)].availability[Number(target.dataset.a)][target.dataset.k] = target.value;
    saveState();
    return;
  }
  if (target.dataset.s != null && target.dataset.t == null) {
    const show = state.shows[Number(target.dataset.s)];
    show[target.dataset.k] = target.dataset.k === "guests" ? Number(target.value) : target.value;
    saveState();
    if (target.dataset.k === "guests" || target.dataset.k === "name") renderShows();
    return;
  }
  if (target.dataset.s != null && target.dataset.t != null) {
    const setTime = state.shows[Number(target.dataset.s)].setTimes[Number(target.dataset.t)];
    setTime[target.dataset.k] = target.value;
    saveState();
    if (target.dataset.k === "type" || target.dataset.k === "start") renderShows();
  }
});

document.addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target) return;
  if (target.id === "add-worker") {
    state.workers.push({ id: uid("w"), name: "Worker", availability: [] });
    saveState();
    renderWorkers();
    return;
  }
  if (target.id === "add-show") {
    state.shows.push({ id: uid("s"), name: "Show", guests: 20, setTimes: [] });
    saveState();
    renderShows();
    return;
  }
  if (target.id === "load-sample") {
    loadSample();
    return;
  }
  if (target.id === "solve") {
    runSolve();
    return;
  }
  if (target.dataset.removeWorker != null) {
    state.workers.splice(Number(target.dataset.removeWorker), 1);
    saveState();
    renderWorkers();
    return;
  }
  if (target.dataset.addAvail != null) {
    const worker = state.workers[Number(target.dataset.addAvail)];
    worker.availability = worker.availability || [];
    worker.availability.push({ start: "10:00", end: "22:00" });
    saveState();
    renderWorkers();
    return;
  }
  if (target.dataset.removeAvail != null) {
    const [wIndex, aIndex] = target.dataset.removeAvail.split(":").map(Number);
    state.workers[wIndex].availability.splice(aIndex, 1);
    saveState();
    renderWorkers();
    return;
  }
  if (target.dataset.removeShow != null) {
    state.shows.splice(Number(target.dataset.removeShow), 1);
    saveState();
    renderShows();
    return;
  }
  if (target.dataset.addSet != null) {
    const show = state.shows[Number(target.dataset.addSet)];
    show.setTimes = show.setTimes || [];
    show.setTimes.push({ id: uid("set"), type: "B", start: "18:00" });
    saveState();
    renderShows();
    return;
  }
  if (target.dataset.removeSet != null) {
    const [sIndex, tIndex] = target.dataset.removeSet.split(":").map(Number);
    state.shows[sIndex].setTimes.splice(tIndex, 1);
    saveState();
    renderShows();
  }
});

if (!loadState()) {
  loadSample();
} else {
  render();
}
