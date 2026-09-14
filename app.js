const STORAGE_KEY = "showflow-day-v2";

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
    state.workers = parsed.workers.map(normalizeWorker);
    state.shows = parsed.shows.map(normalizeShow);
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

function normalizeWorker(worker) {
  return {
    id: worker.id || uid("w"),
    name: worker.name || "Worker",
    preferredZone: worker.preferredZone || "",
    leadWeight: worker.leadWeight == null || worker.leadWeight === "" ? 5 : Number(worker.leadWeight),
    availability: Array.isArray(worker.availability) ? worker.availability : []
  };
}

function normalizeShow(show) {
  const showtimes = Array.isArray(show.showtimes)
    ? show.showtimes
    : (show.setTimes || []).map((setTime) => ({
        id: setTime.id || uid("st"),
        room: 1,
        start: setTime.start || "18:00",
        duration: 60
      }));
  return {
    id: show.id || uid("s"),
    name: show.name || "Show",
    theater: show.theater || "default",
    guests: Number(show.guests) || 0,
    showtimes
  };
}

function loadSample() {
  const sample = sampleDay();
  state.dayLabel = sample.dayLabel;
  state.workers = sample.workers.map(normalizeWorker);
  state.shows = sample.shows.map(normalizeShow);
  state.result = null;
  saveState();
  render();
}

function el(html) {
  const template = document.createElement("template");
  template.innerHTML = html.trim();
  return template.content.firstElementChild;
}

function derivedChips(showtime) {
  const windows = deriveWindows(showtime.start, showtime.duration);
  if (!windows) {
    return '<div class="chip-row"><span class="chip">invalid start / duration</span></div>';
  }
  return `<div class="chip-row">
    <span class="chip a">A ${rangeLabel(windows.aWindow)}</span>
    <span class="chip b">B ${rangeLabel(windows.bWindow)}</span>
    <span class="chip c">C ${formatHm(windows.cEnd)}</span>
  </div>`;
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
        <div class="row" style="margin-top:8px">
          <label class="field"><span>Preferred zone</span>
            <select data-w="${index}" data-k="preferredZone">
              <option value="" ${!worker.preferredZone ? "selected" : ""}>None</option>
              <option value="MAIN" ${worker.preferredZone === "MAIN" ? "selected" : ""}>MAIN · rooms 1–4</option>
              <option value="SIDE" ${worker.preferredZone === "SIDE" ? "selected" : ""}>SIDE · rooms 5–7</option>
            </select>
          </label>
          <label class="field"><span>Lead weight</span>
            <input type="number" min="0" max="10" data-w="${index}" data-k="leadWeight" value="${escapeAttr(worker.leadWeight)}">
          </label>
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
        </div>
        <div class="row" style="margin-top:8px">
          <label class="field"><span>Theater</span><input data-s="${index}" data-k="theater" value="${escapeAttr(show.theater || "default")}"></label>
          <label class="field"><span>Guests</span><input type="number" min="0" data-s="${index}" data-k="guests" value="${escapeAttr(show.guests)}"></label>
        </div>
        <div class="muted" style="margin-top:8px">${required} worker${required === 1 ? "" : "s"} per showtime · A/B/C are derived</div>
        <div class="sets" data-sets="${index}"></div>
        <div class="transport">
          <button data-add-set="${index}">Add showtime</button>
        </div>
      </div>
    `);
    const sets = card.querySelector(".sets");
    (show.showtimes || []).forEach((showtime, setIndex) => {
      sets.appendChild(el(`
        <div class="row" style="margin-top:10px">
          <label class="field"><span>Showtime ID</span><input data-s="${index}" data-t="${setIndex}" data-k="id" value="${escapeAttr(showtime.id)}"></label>
          <label class="field"><span>Room</span>
            <select data-s="${index}" data-t="${setIndex}" data-k="room">
              ${[1, 2, 3, 4, 5, 6, 7].map((room) => `
                <option value="${room}" ${Number(showtime.room) === room ? "selected" : ""}>${room} · ${room <= 4 ? "MAIN" : "SIDE"}</option>
              `).join("")}
            </select>
          </label>
          <label class="field"><span>Start</span><input type="time" data-s="${index}" data-t="${setIndex}" data-k="start" value="${escapeAttr(showtime.start)}"></label>
          <label class="field"><span>Duration (min)</span><input type="number" min="1" data-s="${index}" data-t="${setIndex}" data-k="duration" value="${escapeAttr(showtime.duration)}"></label>
          <button data-remove-set="${index}:${setIndex}">×</button>
        </div>
      `));
      sets.appendChild(el(derivedChips(showtime)));
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
    return (show.showtimes || []).map((showtime) => {
      const assigned = new Set(
        result.assignments
          .filter((slot) => slot.showId === show.id && slot.showtimeId === showtime.id)
          .map((slot) => slot.workerId)
      ).size;
      const windows = deriveWindows(showtime.start, showtime.duration);
      const derived = windows
        ? `A ${rangeLabel(windows.aWindow)} · B ${rangeLabel(windows.bWindow)} · C ${formatHm(windows.cEnd)}`
        : "";
      const cls = assigned >= required ? "ok" : "bad";
      return `<tr>
        <td>${escapeHtml(show.name)}</td>
        <td>rm ${escapeHtml(showtime.room)} · ${escapeHtml(showtime.start)} +${escapeHtml(showtime.duration)}m</td>
        <td>${escapeHtml(derived)}</td>
        <td class="${cls}">${assigned}/${required}</td>
      </tr>`;
    });
  }).join("");

  const assignmentRows = result.assignments.map((slot) => {
    const worker = workerById[slot.workerId];
    const show = showById[slot.showId];
    const windows = slot.aWindow && slot.bWindow && slot.cEnd != null
      ? `A ${rangeLabel(slot.aWindow)} · C ${formatHm(slot.cEnd)}`
      : rangeLabel(slotRange(slot));
    return `<tr>
      <td>${escapeHtml(worker ? worker.name : slot.workerId)}</td>
      <td>${escapeHtml(show ? show.name : slot.showId)}</td>
      <td>rm ${escapeHtml(slot.roomNumber)}${slot.lead ? " · LEAD" : ""}</td>
      <td>${escapeHtml(windows)}</td>
      <td>${slot.coverageSlot}</td>
      <td class="${slot.warnings.length ? "warn-text" : "ok"}">${slot.warnings.length ? slot.warnings.length + " warning(s)" : "ok"}</td>
    </tr>`;
  }).join("");

  const gapRows = result.coverageGaps.length
    ? result.coverageGaps.map((gap) => {
      const show = showById[gap.showId];
      return `<tr><td>${escapeHtml(show ? show.name : gap.showId)}</td><td>${escapeHtml(gap.showtimeId || gap.setTimeId)}</td><td class="bad">missing ${gap.missing}</td></tr>`;
    }).join("")
    : '<tr><td colspan="3" class="ok">NONE</td></tr>';

  const warningRows = result.warnings.length
    ? result.warnings.map((warning) => {
      const worker = workerById[warning.workerId];
      const from = warning.existingShowtimeId || warning.existingAssignmentId || "—";
      const to = warning.newShowtimeId || warning.newAssignmentId || "";
      return `<tr>
        <td>${escapeHtml(worker ? worker.name : warning.workerId)}</td>
        <td>${escapeHtml(from)} → ${escapeHtml(to)}</td>
        <td class="warn-text">${escapeHtml(warning.message)}${warning.overlapMinutes ? " (" + warning.overlapMinutes + " min)" : ""}</td>
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
    <div class="table-wrap"><table><thead><tr><th>Show</th><th>Showtime</th><th>Derived A/B/C</th><th>Staff</th></tr></thead><tbody>${coverageRows || '<tr><td colspan="4">None</td></tr>'}</tbody></table></div>
    <h3 class="muted" style="margin:16px 0 8px">ASSIGNMENTS</h3>
    <div class="table-wrap"><table><thead><tr><th>Worker</th><th>Show</th><th>Room</th><th>Window</th><th>Slot</th><th>Flags</th></tr></thead><tbody>${assignmentRows || '<tr><td colspan="6">None</td></tr>'}</tbody></table></div>
    <h3 class="muted" style="margin:16px 0 8px">GAPS</h3>
    <div class="table-wrap"><table><thead><tr><th>Show</th><th>Showtime</th><th>Missing</th></tr></thead><tbody>${gapRows}</tbody></table></div>
    <h3 class="muted" style="margin:16px 0 8px">WARNINGS</h3>
    <div class="table-wrap"><table><thead><tr><th>Worker</th><th>Showtimes</th><th>Message</th></tr></thead><tbody>${warningRows}</tbody></table></div>
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
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/"/g, """);
}

function coerceField(key, value) {
  if (key === "guests" || key === "duration" || key === "room" || key === "leadWeight") {
    return value === "" ? "" : Number(value);
  }
  return value;
}

document.addEventListener("input", (event) => {
  const target = event.target;
  if (target.id === "day-label") {
    state.dayLabel = target.value;
    saveState();
    return;
  }
  if (target.dataset.w != null && target.dataset.a == null) {
    state.workers[Number(target.dataset.w)][target.dataset.k] = coerceField(target.dataset.k, target.value);
    saveState();
    if (target.dataset.k === "name") renderWorkers();
    return;
  }
  if (target.dataset.w != null && target.dataset.a != null) {
    state.workers[Number(target.dataset.w)].availability[Number(target.dataset.a)][target.dataset.k] = target.value;
    saveState();
    return;
  }
  if (target.dataset.s != null && target.dataset.t == null) {
    const show = state.shows[Number(target.dataset.s)];
    show[target.dataset.k] = coerceField(target.dataset.k, target.value);
    saveState();
    if (target.dataset.k === "guests" || target.dataset.k === "name") renderShows();
    return;
  }
  if (target.dataset.s != null && target.dataset.t != null) {
    const showtime = state.shows[Number(target.dataset.s)].showtimes[Number(target.dataset.t)];
    showtime[target.dataset.k] = coerceField(target.dataset.k, target.value);
    saveState();
    if (target.dataset.k === "start" || target.dataset.k === "duration" || target.dataset.k === "room") {
      renderShows();
    }
  }
});

document.addEventListener("click", (event) => {
  const target = event.target.closest("button");
  if (!target) return;
  if (target.id === "add-worker") {
    state.workers.push(normalizeWorker({ id: uid("w"), name: "Worker", preferredZone: "", leadWeight: 5, availability: [] }));
    saveState();
    renderWorkers();
    return;
  }
  if (target.id === "add-show") {
    state.shows.push(normalizeShow({ id: uid("s"), name: "Show", theater: "default", guests: 20, showtimes: [] }));
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
    show.showtimes = show.showtimes || [];
    show.showtimes.push({ id: uid("st"), room: 1, start: "19:00", duration: 60 });
    saveState();
    renderShows();
    return;
  }
  if (target.dataset.removeSet != null) {
    const [sIndex, tIndex] = target.dataset.removeSet.split(":").map(Number);
    state.shows[sIndex].showtimes.splice(tIndex, 1);
    saveState();
    renderShows();
  }
});

if (!loadState()) {
  loadSample();
} else {
  render();
}
