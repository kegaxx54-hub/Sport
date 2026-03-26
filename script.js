const SUPPLEMENTS = [
  "alphaMorning",
  "omegaMorning",
  "collagene",
  "creatine",
  "preworkout",
  "whey",
  "alphaEvening",
  "omegaEvening",
  "water",
];

const STORAGE_PREFIX = "suppTracker";

const monthPicker = document.getElementById("monthPicker");
const trackerBody = document.querySelector("#trackerTable tbody");
const workoutForm = document.getElementById("workoutForm");
const workoutTableBody = document.querySelector("#workoutTable tbody");
const monthlySummary = document.getElementById("monthlySummary");
const resetMonthBtn = document.getElementById("resetMonthBtn");

function getMonthKey(ym) {
  return `${STORAGE_PREFIX}:${ym}`;
}

function getTodayMonth() {
  return new Date().toISOString().slice(0, 7);
}

function getDaysInMonth(ym) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

function loadData(ym) {
  const raw = localStorage.getItem(getMonthKey(ym));
  if (!raw) {
    return { days: {}, workouts: [] };
  }
  try {
    const parsed = JSON.parse(raw);
    return {
      days: parsed.days || {},
      workouts: Array.isArray(parsed.workouts) ? parsed.workouts : [],
    };
  } catch {
    return { days: {}, workouts: [] };
  }
}

function saveData(ym, data) {
  localStorage.setItem(getMonthKey(ym), JSON.stringify(data));
}

function createCheckbox(ym, day, key, checked) {
  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.checked = checked;
  cb.addEventListener("change", () => {
    const data = loadData(ym);
    if (!data.days[day]) {
      data.days[day] = {};
    }
    data.days[day][key] = cb.checked;
    saveData(ym, data);
    renderSummary(ym);
  });
  return cb;
}

function renderTracker(ym) {
  const data = loadData(ym);
  const days = getDaysInMonth(ym);
  trackerBody.innerHTML = "";

  for (let day = 1; day <= days; day++) {
    const tr = document.createElement("tr");
    const dayCell = document.createElement("td");
    dayCell.textContent = String(day);
    tr.appendChild(dayCell);

    for (const key of SUPPLEMENTS) {
      const td = document.createElement("td");
      const checked = Boolean(data.days?.[day]?.[key]);
      td.appendChild(createCheckbox(ym, day, key, checked));
      tr.appendChild(td);
    }
    trackerBody.appendChild(tr);
  }
}

function renderWorkouts(ym) {
  const data = loadData(ym);
  workoutTableBody.innerHTML = "";

  if (!data.workouts.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = "<td colspan='5'>Aucune seance enregistree pour ce mois.</td>";
    workoutTableBody.appendChild(tr);
    return;
  }

  data.workouts
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach((w, index) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${w.date}</td>
        <td>${w.type}</td>
        <td>${w.duration ? `${w.duration} min` : "-"}</td>
        <td>${w.notes || "-"}</td>
      `;

      const action = document.createElement("td");
      const del = document.createElement("button");
      del.type = "button";
      del.textContent = "Supprimer";
      del.className = "danger";
      del.addEventListener("click", () => {
        const latest = loadData(ym);
        latest.workouts.splice(index, 1);
        saveData(ym, latest);
        renderWorkouts(ym);
        renderSummary(ym);
      });
      action.appendChild(del);
      tr.appendChild(action);
      workoutTableBody.appendChild(tr);
    });
}

function statCard(label, value) {
  return `<div class="stat"><div class="label">${label}</div><div class="value">${value}</div></div>`;
}

function renderSummary(ym) {
  const data = loadData(ym);
  const days = getDaysInMonth(ym);
  const targetTicks = days * SUPPLEMENTS.length;
  let doneTicks = 0;

  for (let day = 1; day <= days; day++) {
    for (const key of SUPPLEMENTS) {
      if (data.days?.[day]?.[key]) {
        doneTicks += 1;
      }
    }
  }

  const adherence = targetTicks ? Math.round((doneTicks / targetTicks) * 100) : 0;
  const workouts = data.workouts.length;
  const totalMinutes = data.workouts.reduce((sum, w) => sum + (Number(w.duration) || 0), 0);
  const avgMinutes = workouts ? Math.round(totalMinutes / workouts) : 0;

  let emoji = "🙂";
  if (adherence >= 90) emoji = "🔥";
  else if (adherence >= 75) emoji = "💪";
  else if (adherence < 50) emoji = "⚠️";

  monthlySummary.innerHTML = [
    statCard("Adherence supplements", `${adherence}% ${emoji}`),
    statCard("Cases cochees", `${doneTicks} / ${targetTicks}`),
    statCard("Seances effectuees", workouts),
    statCard("Temps total sport", `${totalMinutes} min`),
    statCard("Duree moyenne seance", `${avgMinutes} min`),
  ].join("");
}

function initMonth() {
  const ym = monthPicker.value || getTodayMonth();
  monthPicker.value = ym;
  renderTracker(ym);
  renderWorkouts(ym);
  renderSummary(ym);
}

monthPicker.addEventListener("change", initMonth);

workoutForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const ym = monthPicker.value;
  const date = document.getElementById("workoutDate").value;
  const type = document.getElementById("workoutType").value.trim();
  const duration = document.getElementById("workoutDuration").value;
  const notes = document.getElementById("workoutNotes").value.trim();

  if (!date || !type) {
    return;
  }

  if (!date.startsWith(ym)) {
    alert("La date de seance doit etre dans le mois selectionne.");
    return;
  }

  const data = loadData(ym);
  data.workouts.push({ date, type, duration, notes });
  saveData(ym, data);

  workoutForm.reset();
  renderWorkouts(ym);
  renderSummary(ym);
});

resetMonthBtn.addEventListener("click", () => {
  const ym = monthPicker.value;
  const yes = confirm(`Reinitialiser toutes les donnees pour ${ym} ?`);
  if (!yes) return;
  localStorage.removeItem(getMonthKey(ym));
  initMonth();
});

initMonth();
