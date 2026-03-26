import { initializeApp } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js";
import { getDatabase, ref, get, set } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDHfWWs-vFDHrVxBcsfQkh0ZiOq4hZOhFI",
  authDomain: "ouii-960a2.firebaseapp.com",
  databaseURL: "https://ouii-960a2-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "ouii-960a2",
  storageBucket: "ouii-960a2.firebasestorage.app",
  messagingSenderId: "547009328782",
  appId: "1:547009328782:web:6e020a8e0da905ba84fbdf",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

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
const USER_ID = "kevin";

const monthPicker = document.getElementById("monthPicker");
const trackerBody = document.querySelector("#trackerTable tbody");
const workoutForm = document.getElementById("workoutForm");
const workoutTableBody = document.querySelector("#workoutTable tbody");
const monthlySummary = document.getElementById("monthlySummary");
const resetMonthBtn = document.getElementById("resetMonthBtn");

let currentData = { days: {}, workouts: [] };

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

function readLocalData(ym) {
  const raw = localStorage.getItem(getMonthKey(ym));
  if (!raw) return { days: {}, workouts: [] };
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

function writeLocalData(ym, data) {
  localStorage.setItem(getMonthKey(ym), JSON.stringify(data));
}

async function loadData(ym) {
  const path = ref(db, `users/${USER_ID}/months/${ym}`);
  try {
    const snapshot = await get(path);
    if (snapshot.exists()) {
      const remoteData = snapshot.val();
      const normalized = {
        days: remoteData.days || {},
        workouts: Array.isArray(remoteData.workouts) ? remoteData.workouts : [],
      };
      writeLocalData(ym, normalized);
      return normalized;
    }
  } catch {
    // Fallback local if Firebase unavailable.
  }
  return readLocalData(ym);
}

async function saveData(ym, data) {
  writeLocalData(ym, data);
  const path = ref(db, `users/${USER_ID}/months/${ym}`);
  await set(path, data);
}

function createCheckbox(ym, day, key, checked) {
  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.checked = checked;
  cb.addEventListener("change", async () => {
    if (!currentData.days[day]) {
      currentData.days[day] = {};
    }
    currentData.days[day][key] = cb.checked;
    try {
      await saveData(ym, currentData);
      renderSummary(ym);
    } catch {
      alert("Erreur de sauvegarde en ligne. Donnees gardees en local.");
    }
  });
  return cb;
}

function renderTracker(ym) {
  const days = getDaysInMonth(ym);
  trackerBody.innerHTML = "";

  for (let day = 1; day <= days; day++) {
    const tr = document.createElement("tr");
    const dayCell = document.createElement("td");
    dayCell.textContent = String(day);
    tr.appendChild(dayCell);

    for (const key of SUPPLEMENTS) {
      const td = document.createElement("td");
      const checked = Boolean(currentData.days?.[day]?.[key]);
      td.appendChild(createCheckbox(ym, day, key, checked));
      tr.appendChild(td);
    }
    trackerBody.appendChild(tr);
  }
}

function renderWorkouts(ym) {
  workoutTableBody.innerHTML = "";

  if (!currentData.workouts.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = "<td colspan='5'>Aucune seance enregistree pour ce mois.</td>";
    workoutTableBody.appendChild(tr);
    return;
  }

  currentData.workouts
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach((w) => {
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
      del.addEventListener("click", async () => {
        currentData.workouts = currentData.workouts.filter(
          (item) =>
            !(
              item.date === w.date &&
              item.type === w.type &&
              String(item.duration || "") === String(w.duration || "") &&
              String(item.notes || "") === String(w.notes || "")
            )
        );
        try {
          await saveData(ym, currentData);
          renderWorkouts(ym);
          renderSummary(ym);
        } catch {
          alert("Erreur de suppression en ligne. Reessaie.");
        }
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
  const days = getDaysInMonth(ym);
  const targetTicks = days * SUPPLEMENTS.length;
  let doneTicks = 0;

  for (let day = 1; day <= days; day++) {
    for (const key of SUPPLEMENTS) {
      if (currentData.days?.[day]?.[key]) {
        doneTicks += 1;
      }
    }
  }

  const adherence = targetTicks ? Math.round((doneTicks / targetTicks) * 100) : 0;
  const workouts = currentData.workouts.length;
  const totalMinutes = currentData.workouts.reduce((sum, w) => sum + (Number(w.duration) || 0), 0);
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

async function initMonth() {
  const ym = monthPicker.value || getTodayMonth();
  monthPicker.value = ym;
  currentData = await loadData(ym);
  renderTracker(ym);
  renderWorkouts(ym);
  renderSummary(ym);
}

monthPicker.addEventListener("change", () => {
  initMonth();
});

workoutForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const ym = monthPicker.value;
  const date = document.getElementById("workoutDate").value;
  const type = document.getElementById("workoutType").value.trim();
  const duration = document.getElementById("workoutDuration").value;
  const notes = document.getElementById("workoutNotes").value.trim();

  if (!date || !type) return;

  if (!date.startsWith(ym)) {
    alert("La date de seance doit etre dans le mois selectionne.");
    return;
  }

  currentData.workouts.push({ date, type, duration, notes });
  try {
    await saveData(ym, currentData);
    workoutForm.reset();
    renderWorkouts(ym);
    renderSummary(ym);
  } catch {
    alert("Erreur de sauvegarde de la seance.");
  }
});

resetMonthBtn.addEventListener("click", async () => {
  const ym = monthPicker.value;
  const yes = confirm(`Reinitialiser toutes les donnees pour ${ym} ?`);
  if (!yes) return;
  currentData = { days: {}, workouts: [] };
  try {
    await saveData(ym, currentData);
    initMonth();
  } catch {
    alert("Erreur de reinitialisation en ligne.");
  }
});

initMonth();
