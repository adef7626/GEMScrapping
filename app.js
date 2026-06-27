/**
 * ==========================================================================
 * ADRENALINE FORGE - CORE APPLICATION LOGIC
 * ==========================================================================
 */

// Application Constants & Default Database
const STORAGE_KEY = "gym-tracker-inline";
const CUSTOM_EXER_KEY = "gym-tracker-custom-exercises";
const HEADLINE_KEY = "gym-tracker-headline";
const BODYWEIGHT_KEY = "gym-tracker-bodyweight";
const MODE_KEY = "gym-tracker-mode";
const UNIT_KEY = "gym-tracker-unit";

// IndexedDB Core Key-Value Helper
const dbName = "adrenaline_forge_db";
const storeName = "kv_store";

function getDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(storeName);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

const db = {
  async get(key) {
    try {
      const database = await getDB();
      return new Promise((resolve, reject) => {
        const transaction = database.transaction(storeName, "readonly");
        const store = transaction.objectStore(storeName);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn("IndexedDB read failed, key:", key, e);
      return null;
    }
  },
  async set(key, value) {
    try {
      const database = await getDB();
      return new Promise((resolve, reject) => {
        const transaction = database.transaction(storeName, "readwrite");
        const store = transaction.objectStore(storeName);
        const req = store.put(value, key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn("IndexedDB set failed, key:", key, e);
    }
  },
  async remove(key) {
    try {
      const database = await getDB();
      return new Promise((resolve, reject) => {
        const transaction = database.transaction(storeName, "readwrite");
        const store = transaction.objectStore(storeName);
        const req = store.delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn("IndexedDB remove failed, key:", key, e);
    }
  }
};

// Asynchronous persistent getter with LocalStorage fallback / migration
async function getPersistentItem(key, defaultValue) {
  try {
    const val = await db.get(key);
    if (val !== undefined && val !== null) return val;
  } catch (e) {
    console.warn("IndexedDB persistent lookup failed, using local storage:", e);
  }
  // Fallback and migrate LocalStorage
  const localVal = localStorage.getItem(key);
  if (localVal !== null) {
    let parsed = localVal;
    try { parsed = JSON.parse(localVal); } catch {}
    await db.set(key, parsed);
    return parsed;
  }
  return defaultValue;
}

const MUSCLES = [
  "Chest",
  "Triceps",
  "Back",
  "Biceps",
  "Abs",
  "Cardio",
  "Shoulder",
  "Forearms",
  "Legs"
];

const STANDARD_WEIGHTS = [2.5, 5, 7.5, 10, 12.5, 15, 17.5, 20, 22.5, 25, 30, 35, 40, 45, 50, 55, 60, 70, 80, 90, 100];
const STANDARD_REPS = [5, 10, 12, 15, 19, 20, 25, 30];

const DEFAULT_EXERCISES = {
  "Chest": [
    { name: "Incline Press (Dumbbell)", type: "weighted" },
    { name: "Chest Fly Machine", type: "weighted" },
    { name: "Push-ups", type: "bodyweight" },
    { name: "Chest Bench Press", type: "weighted" },
    { name: "Inclined Bench Press", type: "weighted" },
    { name: "Fly (Dumbbell)", type: "weighted" }
  ],
  "Triceps": [
    { name: "Tricep Pushdown", type: "weighted" },
    { name: "Overhead Tricep Extension", type: "weighted" },
    { name: "Triceps Extension", type: "weighted" },
    { name: "Rope Pushdown", type: "weighted" },
    { name: "Dips", type: "bodyweight" }
  ],
  "Back": [
    { name: "Lat Pulldown", type: "weighted" },
    { name: "Seated Row", type: "weighted" },
    { name: "Deadlift", type: "weighted" },
    { name: "Pull-ups", type: "bodyweight" },
    { name: "Single Arm Rowing", type: "weighted" },
    { name: "Shrugs (Dumbbell)", type: "weighted" },
    { name: "Back Extension", type: "bodyweight" }
  ],
  "Biceps": [
    { name: "Curl (Barbell)", type: "weighted" },
    { name: "Pitchers", type: "weighted" },
    { name: "Hammer Curl (Dumbbell)", type: "weighted" },
    { name: "Zigzag Bar Curl", type: "weighted" }
  ],
  "Abs": [
    { name: "Crunches", type: "bodyweight" },
    { name: "Leg Raise", type: "bodyweight" },
    { name: "Cable Crunch", type: "weighted" },
    { name: "Plank", type: "bodyweight" }
  ],
  "Legs": [
    { name: "Back Squat", type: "weighted" },
    { name: "Leg Press", type: "weighted" },
    { name: "Romanian Deadlift", type: "weighted" },
    { name: "Leg Extension", type: "weighted" },
    { name: "Leg Curl", type: "weighted" },
    { name: "Adductor", type: "weighted" },
    { name: "Squats", type: "bodyweight" },
    { name: "Lunges", type: "bodyweight" },
    { name: "Calf Raise", type: "bodyweight" }
  ],
  "Shoulder": [
    { name: "Shoulder Press (Dumbbell)", type: "weighted" },
    { name: "Lateral Raise", type: "weighted" },
    { name: "Face Pull", type: "weighted" },
    { name: "Reverse Pec Deck", type: "weighted" },
    { name: "Shoulder Press", type: "weighted" },
    { name: "Shoulder Raise", type: "weighted" }
  ],
  "Forearms": [
    { name: "Forearm Curl", type: "weighted" },
    { name: "Reverse Wrist Curl", type: "weighted" },
    { name: "Wrist Curl", type: "weighted" }
  ],
  "Cardio": [
    { name: "Treadmill", type: "cardio" },
    { name: "Cycling", type: "cardio" },
    { name: "Running", type: "cardio" },
    { name: "Walking", type: "cardio" },
    { name: "Rowing", type: "cardio" }
  ]
};

// Migration maps for splitting old combined muscle groups and renaming exercises
const EXERCISE_NAME_MIGRATION = {
  "Incline Dumbbell Press": "Incline Press (Dumbbell)",
  "Dumbbell Fly": "Fly (Dumbbell)",
  "Dumbbell Shrugs": "Shrugs (Dumbbell)",
  "Dumbbell Hammer": "Hammer Curl (Dumbbell)",
  "Dumbbell Shoulder Press": "Shoulder Press (Dumbbell)",
  "Barbell Curl": "Curl (Barbell)"
};

// Maps exercise names (old and new) to their correct new muscle group
const EXERCISE_TO_NEW_MUSCLE = {
  "Incline Dumbbell Press": "Chest", "Incline Press (Dumbbell)": "Chest",
  "Chest Fly Machine": "Chest",
  "Push-ups": "Chest",
  "Chest Bench Press": "Chest",
  "Inclined Bench Press": "Chest",
  "Dumbbell Fly": "Chest", "Fly (Dumbbell)": "Chest",
  "Tricep Pushdown": "Triceps",
  "Overhead Tricep Extension": "Triceps",
  "Triceps Extension": "Triceps",
  "Rope Pushdown": "Triceps",
  "Dips": "Triceps",
  "Lat Pulldown": "Back",
  "Seated Row": "Back",
  "Deadlift": "Back",
  "Pull-ups": "Back",
  "Single Arm Rowing": "Back",
  "Dumbbell Shrugs": "Back", "Shrugs (Dumbbell)": "Back",
  "Back Extension": "Back",
  "Barbell Curl": "Biceps", "Curl (Barbell)": "Biceps",
  "Pitchers": "Biceps",
  "Dumbbell Hammer": "Biceps", "Hammer Curl (Dumbbell)": "Biceps",
  "Zigzag Bar Curl": "Biceps",
  "Dumbbell Shoulder Press": "Shoulder", "Shoulder Press (Dumbbell)": "Shoulder",
  "Lateral Raise": "Shoulder",
  "Face Pull": "Shoulder",
  "Reverse Pec Deck": "Shoulder",
  "Shoulder Press": "Shoulder",
  "Shoulder Raise": "Shoulder",
  "Forearm Curl": "Forearms",
  "Reverse Wrist Curl": "Forearms",
  "Wrist Curl": "Forearms"
};

function migrateMuscleSplit() {
  const OLD_GROUPS = ["Chest & Triceps", "Back & Biceps", "Shoulder and Forearms"];
  let needsSave = false;

  // Migrate workout entries
  state.entries.forEach(entry => {
    // Rename exercise names (Dumbbell/Barbell to end)
    if (EXERCISE_NAME_MIGRATION[entry.exercise]) {
      entry.exercise = EXERCISE_NAME_MIGRATION[entry.exercise];
      needsSave = true;
    }
    // Split old combined muscle groups into individual ones
    if (OLD_GROUPS.includes(entry.muscle)) {
      const newMuscle = EXERCISE_TO_NEW_MUSCLE[entry.exercise];
      if (newMuscle) {
        entry.muscle = newMuscle;
        needsSave = true;
      } else if (entry.exercise === "__muscle_complete__") {
        // For completion markers, we can't determine which sub-group, remove them
        entry.muscle = entry.muscle; // keep as-is, will be cleaned up
        needsSave = true;
      }
    }
  });

  // Remove orphaned completion markers for old combined groups
  state.entries = state.entries.filter(e => {
    if (e.exercise === "__muscle_complete__" && OLD_GROUPS.includes(e.muscle)) return false;
    return true;
  });

  // Migrate custom exercises from old groups to new groups
  OLD_GROUPS.forEach(oldGroup => {
    if (state.customExercises[oldGroup] && state.customExercises[oldGroup].length > 0) {
      state.customExercises[oldGroup].forEach(ex => {
        const newName = EXERCISE_NAME_MIGRATION[ex.name] || ex.name;
        const newMuscle = EXERCISE_TO_NEW_MUSCLE[ex.name] || EXERCISE_TO_NEW_MUSCLE[newName];
        if (newMuscle) {
          if (!state.customExercises[newMuscle]) state.customExercises[newMuscle] = [];
          state.customExercises[newMuscle].push({ ...ex, name: newName });
        }
      });
      delete state.customExercises[oldGroup];
      needsSave = true;
    }
  });

  // Also rename exercise names in custom exercises for all groups
  Object.keys(state.customExercises).forEach(muscle => {
    if (state.customExercises[muscle]) {
      state.customExercises[muscle].forEach(ex => {
        if (EXERCISE_NAME_MIGRATION[ex.name]) {
          ex.name = EXERCISE_NAME_MIGRATION[ex.name];
          needsSave = true;
        }
      });
    }
  });

  if (needsSave) saveAllData();
}

// Application State
let state = {
  selectedMuscle: null,
  selectedExercise: null,
  entries: [],
  customExercises: {},
  bodyweightEntries: [],
  headline: "Adrenaline Forge: All‑Out Mode",
  mode: "normal",
  focusMode: false,
  chartInstance: null,
  theme: "orange",
  synthPlaying: false,
  unit: "kg",
  isEditing: false,
  originalEditingExercise: null,
  overviewCharts: []
};

// Haptic & Visual Feedback Helpers
function triggerHaptic(pattern = 15) {
  if ("vibrate" in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch (e) {
      console.log("Haptic vibration blocked or not supported on this device:", e);
    }
  }
}

// Math Utility Formulas
function calculate1RM(weight, reps) {
  if (reps <= 0) return 0;
  if (reps === 1) return weight;
  // Epley Formula
  return Math.round((weight * (1 + reps / 30)) * 10) / 10;
}

function findNearestStandardValue(val, standardArray) {
  if (!standardArray || standardArray.length === 0) return val;
  return standardArray.reduce((prev, curr) => {
    return (Math.abs(curr - val) < Math.abs(prev - val) ? curr : prev);
  });
}

function computeFromSets(sets, type) {
  let totalVolume = 0;
  let topWeight = 0;
  let best1RM = 0;
  let totalDistance = 0;
  let totalTime = 0;

  if (type === "cardio") {
    sets.forEach(s => {
      totalDistance += Number(s.distance || 0);
      totalTime += Number(s.time || 0);
    });
  } else if (type === "bodyweight") {
    sets.forEach(s => {
      totalVolume += Number(s.reps || 0); // volume represents total reps for bodyweight
    });
  } else {
    // Weighted
    sets.forEach(s => {
      const w = Number(s.weight || 0);
      const r = Number(s.reps || 0);
      totalVolume += w * r;
      if (w > topWeight) topWeight = w;
      const current1RM = calculate1RM(w, r);
      if (current1RM > best1RM) best1RM = current1RM;
    });
  }

  return {
    totalVolume: Math.round(totalVolume * 10) / 10,
    topWeight: Math.round(topWeight * 10) / 10,
    best1RM: Math.round(best1RM * 10) / 10,
    totalDistance: Math.round(totalDistance * 100) / 100,
    totalTime: Math.round(totalTime * 10) / 10
  };
}

// Data Normalization & Migrations
function normalizeName(name) {
  return (name || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function formatDate(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function defaultSetsByType(type) {
  if (type === "cardio") return [{ distance: 2.0, time: 15 }];
  if (type === "bodyweight") return [{ reps: 15 }, { reps: 12 }, { reps: 10 }];
  return [{ weight: 10, reps: 15 }, { weight: 12.5, reps: 12 }, { weight: 15, reps: 10 }];
}

function dedupeExerciseObjects(list) {
  const map = new Map();
  (list || []).forEach(item => {
    const obj = typeof item === "string" ? { name: item, type: inferExerciseType(item) } : item;
    const name = (obj?.name || "").trim();
    if (!name) return;
    const key = normalizeName(name);
    if (!map.has(key)) {
      map.set(key, { name, type: obj.type || inferExerciseType(name) });
    }
  });
  return Array.from(map.values()).sort((a, b) => {
    const ga = (a.type || "weighted").localeCompare(b.type || "weighted");
    return ga || a.name.localeCompare(b.name);
  });
}

function inferExerciseType(name) {
  const n = normalizeName(name);
  const cardioWords = ["run", "running", "treadmill", "cycling", "cycle", "walking", "walk", "rowing", "rower", "cardio", "elliptical"];
  const bodyweightWords = ["push-up", "push up", "pull-up", "pull up", "dip", "dips", "crunch", "plank", "leg raise", "squat", "lunge", "calf raise", "back extension"];
  if (cardioWords.some(w => n.includes(w))) return "cardio";
  if (bodyweightWords.some(w => n.includes(w))) return "bodyweight";
  return "weighted";
}

function getAllExercisesForMuscle(muscle) {
  const custom = state.customExercises[muscle] || [];
  return dedupeExerciseObjects(custom);
}

function normalizeSetsByType(sets, type) {
  if (type === "cardio") {
    const normalized = (sets || []).map(s => ({
      distance: Number(s.distance !== undefined ? s.distance : (s.km || 0)) || 0,
      time: Number(s.time || 0) || 0
    })).filter(s => s.distance > 0 || s.time > 0);
    return normalized.length ? normalized : defaultSetsByType(type);
  }
  if (type === "bodyweight") {
    const normalized = (sets || []).map(s => ({ reps: Number(s.reps || 0) || 0 })).filter(s => s.reps > 0);
    return normalized.length ? normalized : defaultSetsByType(type);
  }
  const normalized = (sets || []).map(s => ({
    weight: Number(s.weight || 0) || 0,
    reps: Number(s.reps || 0) || 0
  })).filter(s => s.weight > 0 || s.reps > 0);
  return normalized.length ? normalized : defaultSetsByType(type);
}

// Asynchronous IndexedDB Storage Synchronization
async function loadAllData() {
  // 1. Headline
  state.headline = await getPersistentItem(HEADLINE_KEY, "Adrenaline Forge: All‑Out Mode");
  const headlineEl = document.getElementById("headlineText");
  if (headlineEl) headlineEl.textContent = state.headline;

  // 2. Training Mode
  state.mode = await getPersistentItem(MODE_KEY, "normal");
  const modeSelect = document.getElementById("modeSelect");
  if (modeSelect) modeSelect.value = state.mode;

  // 3. Custom Exercises
  state.customExercises = await getPersistentItem(CUSTOM_EXER_KEY, {});

  // Populate/migrate default exercises into custom exercises if not done yet
  const defaultsLoaded = await getPersistentItem("gym-tracker-defaults-loaded", null);
  if (!defaultsLoaded) {
    MUSCLES.forEach(m => {
      if (!state.customExercises[m]) {
        state.customExercises[m] = [];
      }
      const existingNames = new Set(state.customExercises[m].map(ex => normalizeName(ex.name)));
      const defaults = DEFAULT_EXERCISES[m] || [];
      defaults.forEach(defEx => {
        if (!existingNames.has(normalizeName(defEx.name))) {
          state.customExercises[m].push({ ...defEx });
        }
      });
    });
    await db.set("gym-tracker-defaults-loaded", "true");
  }

  MUSCLES.forEach(m => {
    state.customExercises[m] = dedupeExerciseObjects(state.customExercises[m] || []);
  });

  // 4. Bodyweight logs
  state.bodyweightEntries = await getPersistentItem(BODYWEIGHT_KEY, []);
  state.bodyweightEntries = state.bodyweightEntries
    .filter(item => item && item.date && Number(item.weight) > 0)
    .map(item => ({ date: item.date, weight: Number(item.weight) }))
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  // 5. Workout Logs
  state.entries = await getPersistentItem(STORAGE_KEY, []);

  // Migrate and normalize workout records
  const renameMap = {
    "Chest & Biceps": "Chest & Triceps",
    "Back & Triceps": "Back & Biceps"
  };
  const merged = new Map();

  state.entries.forEach(entry => {
    if (!entry || !entry.date || !entry.exercise) return;
    const muscle = renameMap[entry.muscle] || entry.muscle;
    const exercise = entry.exercise.trim();
    if (!exercise) return;
    const type = entry.type || inferExerciseType(exercise);
    const sets = normalizeSetsByType(entry.sets || [], type);
    const computed = computeFromSets(sets, type);

    const record = {
      date: entry.date,
      muscle,
      exercise,
      type,
      sets,
      totalVolume: computed.totalVolume,
      topWeight: computed.topWeight,
      best1RM: computed.best1RM,
      totalDistance: computed.totalDistance,
      totalTime: computed.totalTime
    };

    if (exercise === "__muscle_complete__") {
      merged.set(`${muscle}__${entry.date}__complete`, record);
      return;
    }

    const key = `${entry.date}__${muscle}__${normalizeName(exercise)}`;
    if (!merged.has(key)) {
      merged.set(key, record);
    } else {
      const existing = merged.get(key);
      const combinedSets = [...(existing.sets || []), ...(record.sets || [])];
      const finalSets = normalizeSetsByType(combinedSets, type);
      const recomputed = computeFromSets(finalSets, type);
      merged.set(key, {
        ...existing,
        sets: finalSets,
        ...recomputed
      });
    }
  });

  state.entries = Array.from(merged.values()).sort((a, b) => new Date(a.date) - new Date(b.date));
  
  // 6. Theme
  state.theme = await getPersistentItem("gym-tracker-theme", "orange");
  document.documentElement.setAttribute("data-theme", state.theme);
  const themeSelect = document.getElementById("themeSelect");
  if (themeSelect) themeSelect.value = state.theme;

  // 7. Global Weight Unit Switch
  state.unit = await getPersistentItem(UNIT_KEY, "kg");
  const unitSelect = document.getElementById("unitSelect");
  if (unitSelect) unitSelect.value = state.unit;
  updateUnitUI();

  saveAllData();
  updateAchievements();

  // Run muscle group split migration (idempotent — only changes old data)
  migrateMuscleSplit();
}

function saveAllData() {
  db.set(STORAGE_KEY, state.entries);
  db.set(CUSTOM_EXER_KEY, state.customExercises);
  db.set(BODYWEIGHT_KEY, state.bodyweightEntries);
  db.set(HEADLINE_KEY, state.headline);
  db.set(MODE_KEY, state.mode);
  db.set("gym-tracker-theme", state.theme);
  db.set(UNIT_KEY, state.unit);
  
  // Keep LocalStorage in sync as a secure background backup!
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.entries));
    localStorage.setItem(CUSTOM_EXER_KEY, JSON.stringify(state.customExercises));
    localStorage.setItem(BODYWEIGHT_KEY, JSON.stringify(state.bodyweightEntries));
    localStorage.setItem(HEADLINE_KEY, state.headline);
    localStorage.setItem(MODE_KEY, state.mode);
    localStorage.setItem("gym-tracker-theme", state.theme);
    localStorage.setItem(UNIT_KEY, state.unit);
  } catch (e) {
    console.warn("LocalStorage background backup failed:", e);
  }

  updateAchievements();
}

function updateUnitUI() {
  const lblBodyweight = document.getElementById("lblBodyweightUnit");
  if (lblBodyweight) lblBodyweight.textContent = `Weight (${state.unit})`;
  
  const inputBodyweight = document.getElementById("bodyweightInput");
  if (inputBodyweight) inputBodyweight.placeholder = `Enter weight in ${state.unit}`;
}

// Navigation & Screen View Controller
let navigationStack = ["view-muscles"];

function switchView(viewId) {
  triggerHaptic(5);

  const currentViewId = navigationStack[navigationStack.length - 1];
  if (currentViewId === viewId) return;

  let direction = "push"; // default to push (slide left)

  // Reset navigation to main menu on completion/reset/cancel
  if (viewId === "view-muscles" && navigationStack.length > 1) {
    direction = "pop";
    navigationStack = ["view-muscles"];
  } else if (navigationStack.length > 1 && navigationStack[navigationStack.length - 2] === viewId) {
    // Going back one step
    direction = "pop";
    navigationStack.pop();
  } else {
    // Going forward
    direction = "push";
    navigationStack.push(viewId);
  }

  const currentView = document.getElementById(currentViewId);
  const targetView = document.getElementById(viewId);

  if (targetView) {
    // Remove all transition classes first
    document.querySelectorAll(".view").forEach(v => {
      v.classList.remove("active", "slide-push-enter", "slide-push-exit", "slide-pop-enter", "slide-pop-exit");
      v.style.display = "none";
    });

    if (currentView && currentViewId !== viewId) {
      currentView.style.display = "block";
      currentView.classList.add(direction === "push" ? "slide-push-exit" : "slide-pop-exit");

      // Hide the old view after slide animation finishes
      setTimeout(() => {
        currentView.style.display = "none";
        currentView.classList.remove("slide-push-exit", "slide-pop-exit");
      }, 350);
    }

    targetView.style.display = "block";
    targetView.classList.add("active", direction === "push" ? "slide-push-enter" : "slide-pop-enter");

    // Smooth scroll to top
    window.scrollTo({ top: 0, behavior: "smooth" });

    // Clean up animation classes from target view after transition finishes
    setTimeout(() => {
      targetView.classList.remove("slide-push-enter", "slide-pop-enter");
    }, 350);
  }
}

// View Initializers and Rendering
function renderMuscleTabs() {
  const container = document.getElementById("muscleTabs");
  if (!container) return;

  container.innerHTML = "";

  // Get last workout date for each muscle
  const lastDates = {};
  state.entries.forEach(e => {
    if (e.exercise === "__muscle_complete__") return;
    if (!lastDates[e.muscle] || new Date(e.date) > new Date(lastDates[e.muscle])) {
      lastDates[e.muscle] = e.date;
    }
  });

  MUSCLES.forEach(m => {
    const tab = document.createElement("button");
    tab.className = "muscle-tab";
    tab.dataset.muscle = m;

    // Apply dynamic muscle fatigue rings based on last log date differences
    const d = lastDates[m];
    let fatigueClass = "cold"; // Cold by default if never trained
    if (d) {
      const lastTime = new Date(d).getTime();
      const todayTime = new Date().getTime();
      const diffDays = (todayTime - lastTime) / (1000 * 60 * 60 * 24);
      if (diffDays < 1) {
        fatigueClass = "fatigued";
      } else if (diffDays <= 4) {
        fatigueClass = "ready";
      } else {
        fatigueClass = "cold";
      }
    }
    tab.classList.add(fatigueClass);

    const name = document.createElement("span");
    name.className = "muscle-name";
    name.textContent = m;

    const last = document.createElement("span");
    last.className = "muscle-last";
    last.textContent = d ? `Last: ${formatDate(d)}` : "Last: –";

    tab.appendChild(name);
    tab.appendChild(last);

    tab.addEventListener("click", () => {
      state.selectedMuscle = m;
      document.querySelectorAll(".muscle-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      initRecapView();
    });

    container.appendChild(tab);
  });
}

function updateMuscleLastTrainedUI() {
  renderMuscleTabs();
}

function initRecapView() {
  const label = document.getElementById("overviewMuscleLabel");
  if (label) label.textContent = `Muscle battlefield: ${state.selectedMuscle}`;

  const container = document.getElementById("overviewList");
  if (!container) return;

  container.innerHTML = "";

  // Destroy existing overview charts to prevent memory leaks
  if (state.overviewCharts && state.overviewCharts.length > 0) {
    state.overviewCharts.forEach(c => {
      if (c) c.destroy();
    });
  }
  state.overviewCharts = [];

  // Find all exercises logged for this muscle
  const allLogs = state.entries.filter(e => e.muscle === state.selectedMuscle && e.exercise !== "__muscle_complete__");
  const uniqueLoggedNames = Array.from(new Set(allLogs.map(l => l.exercise)));

  if (uniqueLoggedNames.length === 0) {
    container.innerHTML = `
      <div class="small-text" style="text-align:center;padding:20px 0;color:var(--text-muted);">
        ⚔️ No workouts logged on this battlefield yet. Let's start attacking!
      </div>`;
  } else {
    // Show cards for each logged exercise showing short recap and line charts
    uniqueLoggedNames.forEach(name => {
      const logs = allLogs.filter(l => normalizeName(l.exercise) === normalizeName(name));
      const latest = logs[logs.length - 1];

      const item = document.createElement("div");
      item.className = "overview-item";
      item.style.cursor = "pointer";
      item.addEventListener("click", () => {
        initWorkoutLoggingView(name);
      });

      const header = document.createElement("div");
      header.className = "overview-header";

      const title = document.createElement("span");
      title.className = "overview-title";
      title.textContent = name;

      const logBtn = document.createElement("button");
      logBtn.className = "btn btn-cyan btn-sm btn-rect";
      logBtn.innerHTML = "🏋️ Log";
      logBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        initWorkoutLoggingView(name);
      });

      header.appendChild(title);
      header.appendChild(logBtn);

      const meta = document.createElement("div");
      meta.className = "overview-meta";
      meta.textContent = `Sessions: ${logs.length} • Last: ${formatDate(latest.date)}`;

      // Create overload chart container
      const chartWrapper = document.createElement("div");
      chartWrapper.className = "overview-chart-wrapper";
      chartWrapper.style.height = "105px";
      chartWrapper.style.marginTop = "8px";
      chartWrapper.style.position = "relative";

      const canvas = document.createElement("canvas");
      canvas.className = "overview-chart-canvas";
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.addEventListener("click", (e) => {
        e.stopPropagation(); // prevent navigation on chart taps to allow tooltips
      });
      chartWrapper.appendChild(canvas);

      item.appendChild(header);
      item.appendChild(meta);
      item.appendChild(chartWrapper);

      container.appendChild(item);

      // Initialize the overload chart on next tick
      setTimeout(() => {
        buildOverviewExerciseChart(canvas, logs, latest.type);
      }, 0);
    });
  }

  switchView("view-overview");
}

function buildOverviewExerciseChart(canvas, logs, type) {
  const ctx = canvas.getContext("2d");

  // Keep latest 5 sessions to keep overview graphs clear
  const subset = logs.slice(-5);

  const labels = subset.map(l => {
    const d = new Date(l.date);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  });

  const dataset1 = [];
  subset.forEach(log => {
    if (type === "cardio") {
      const totalDist = log.sets.reduce((sum, s) => sum + (s.distance || 0), 0);
      dataset1.push(totalDist);
    } else if (type === "bodyweight") {
      const maxReps = Math.max(...log.sets.map(s => s.reps || 0));
      dataset1.push(maxReps);
    } else {
      // Weighted: Top Weight from session
      const maxWeight = Math.max(...log.sets.map(s => s.weight || 0));
      dataset1.push(maxWeight);
    }
  });

  // Colors based on cyberpunk neon theme
  const borderCol = type === "cardio" ? "#ff8c1a" : (type === "bodyweight" ? "#a78bfa" : "#00e5ff");
  const gradient = ctx.createLinearGradient(0, 0, 0, 80);
  if (type === "cardio") {
    gradient.addColorStop(0, "rgba(255, 140, 26, 0.3)");
    gradient.addColorStop(1, "rgba(255, 140, 26, 0.0)");
  } else if (type === "bodyweight") {
    gradient.addColorStop(0, "rgba(167, 139, 250, 0.3)");
    gradient.addColorStop(1, "rgba(167, 139, 250, 0.0)");
  } else {
    gradient.addColorStop(0, "rgba(0, 229, 255, 0.3)");
    gradient.addColorStop(1, "rgba(0, 229, 255, 0.0)");
  }

  const labelName = type === "cardio" ? "Distance (km)" : (type === "bodyweight" ? "Max Reps" : "Top Weight");

  const chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [{
        label: labelName,
        data: dataset1,
        borderColor: borderCol,
        backgroundColor: gradient,
        borderWidth: 2,
        fill: true,
        tension: 0.3,
        pointBackgroundColor: borderCol,
        pointBorderColor: "#ffffff",
        pointRadius: 3,
        pointHoverRadius: 5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "rgba(10, 12, 34, 0.95)",
          titleColor: "#ffffff",
          bodyColor: "#f5f6fa",
          borderColor: "rgba(255, 255, 255, 0.1)",
          borderWidth: 1,
          padding: 6,
          cornerRadius: 6,
          bodyFont: { family: "Inter", size: 10 }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: "#8d94c0", font: { size: 8 } }
        },
        y: {
          grid: { color: "rgba(255, 255, 255, 0.03)" },
          ticks: { color: "#8d94c0", font: { size: 8 } }
        }
      }
    }
  });

  if (!state.overviewCharts) state.overviewCharts = [];
  state.overviewCharts.push(chart);
}

function initWorkoutLoggingView(preselectedExerciseName = null) {
  const label = document.getElementById("currentMuscleLabel");
  if (label) label.textContent = `${state.selectedMuscle} Battlefield`;

  // Reset edit mode state
  state.isEditing = false;
  const btnSave = document.getElementById("btnSaveWorkout");
  if (btnSave) {
    btnSave.innerHTML = "🚀 Save Active Workout Log";
    btnSave.className = "btn btn-primary";
    btnSave.disabled = false;
  }

  // Restore selector visibility and hide edit inputs
  const editExInput = document.getElementById("editExerciseInput");
  const exerciseSelect = document.getElementById("exerciseSelect");
  const btnRename = document.getElementById("btnRenameExercise");
  const btnAdd = document.getElementById("btnAddExercise");
  const btnDel = document.getElementById("btnDeleteExercise");

  if (editExInput) {
    editExInput.style.display = "none";
    editExInput.value = "";
  }
  if (btnRename) {
    btnRename.style.display = "none";
  }
  if (exerciseSelect) exerciseSelect.style.display = "block";
  if (btnAdd) btnAdd.style.display = "block";
  if (btnDel) btnDel.style.display = "block";

  // Pre-fill session date with today's local date
  const dateInput = document.getElementById("sessionDate");
  if (dateInput) {
    const today = new Date();
    const offset = today.getTimezoneOffset();
    const localToday = new Date(today.getTime() - (offset * 60 * 1000));
    dateInput.value = localToday.toISOString().split("T")[0];
  }

  // Clear new exercise fields
  const newExInput = document.getElementById("newExerciseInput");
  const confirmBtn = document.getElementById("btnConfirmAddExercise");
  if (newExInput) newExInput.style.display = "none";
  if (confirmBtn) confirmBtn.style.display = "none";

  // Rebuild exercises selector
  rebuildExerciseSelect(preselectedExerciseName);
  
  switchView("view-workout");
}

function rebuildExerciseSelect(preselectedName = null) {
  const select = document.getElementById("exerciseSelect");
  if (!select) return;

  select.innerHTML = "";
  const exercises = getAllExercisesForMuscle(state.selectedMuscle);

  exercises.forEach(ex => {
    const opt = document.createElement("option");
    opt.value = ex.name;
    opt.textContent = ex.name;
    select.appendChild(opt);
  });

  if (preselectedName) {
    select.value = preselectedName;
  } else if (exercises.length > 0) {
    select.selectedIndex = 0;
  }

  handleExerciseChange();
}

function handleExerciseChange() {
  const select = document.getElementById("exerciseSelect");
  if (!select || !select.value) return;

  state.selectedExercise = select.value;

  const exercises = getAllExercisesForMuscle(state.selectedMuscle);
  const currentMeta = exercises.find(ex => normalizeName(ex.name) === normalizeName(state.selectedExercise));
  
  if (!currentMeta) return;

  // Set the type dropdown in Step 3 automatically
  const typeSelect = document.getElementById("exerciseTypeSelect");
  if (typeSelect) {
    typeSelect.value = currentMeta.type;
  }

  updateLoggingInterface(currentMeta.type);
}

function updateLoggingInterface(type) {
  // Update type description hint
  const hint = document.getElementById("exerciseTypeHint");
  if (hint) {
    if (type === "cardio") {
      hint.textContent = "⚡ Cardio session. Track distance (km) and time (minutes).";
    } else if (type === "bodyweight") {
      const isTimedHint = ["plank", "wall sit", "hollow hold", "dead hang"].some(n =>
        (state.selectedExercise || '').toLowerCase().includes(n)
      );
      hint.textContent = isTimedHint
        ? "⏱️ Timed hold exercise. Track time (seconds) per set."
        : "🤸 Bodyweight session. Track number of reps per set.";
    } else {
      hint.textContent = "🏋️ Weighted session. Track weights (kg) and reps per set.";
    }
  }

  const volumeLabel = document.getElementById("volumeStatLabel");
  if (volumeLabel) {
    volumeLabel.textContent = type === "cardio" ? "Total Time" : (type === "bodyweight" ? "Total Reps" : "Total Volume");
  }

  // Pre-fill sets based on history and training mode
  buildSuggestedSets(type);

  // Update exercise recap / stats (1RM, volume, charts)
  refreshExerciseStats();
}

function buildSuggestedSets(type) {
  const listContainer = document.getElementById("setsList");
  if (!listContainer) return;

  listContainer.innerHTML = "";

  // 1. Fetch last session entries for this specific exercise
  const logs = state.entries.filter(e => 
    e.muscle === state.selectedMuscle && 
    normalizeName(e.exercise) === normalizeName(state.selectedExercise)
  );

  let setsToRender = [];
  let isFromHistory = false;
  const mode = state.mode; // moved here so all type branches can access it

  if (type === "weighted") {
    let baseSets = [];
    if (logs.length > 0) {
      const lastLog = logs[logs.length - 1];

      // Pull previous weights, filter zeros, sort ascending so the pyramid is always
      // lightest → Set 1 (15 reps) and heaviest → Set 3 (10 reps)
      const prevWeights = (lastLog.sets || [])
        .map(s => Number(s.weight) || 0)
        .filter(w => w > 0)
        .sort((a, b) => a - b);

      // Fallback: if fewer than 3 sets logged previously, derive sensible spacing
      const w1 = prevWeights[0] || 10;
      const w2 = prevWeights[1] || (w1 + 5);
      const w3 = prevWeights[2] || (w2 + 5);

      baseSets = [
        { weight: w1, reps: 15 },
        { weight: w2, reps: 12 },
        { weight: w3, reps: 10 }
      ];
      isFromHistory = true;
    } else {
      baseSets = [
        { weight: 10, reps: 15 },
        { weight: 15, reps: 12 },
        { weight: 20, reps: 10 }
      ];
    }

    // Apply mode-based weight increment on top of each base weight:
    // Push  → +2.5kg per set (progressive overload)
    // Easy  → –10% per set (deload)
    // Normal → use base weight as-is (maintain)
    baseSets.forEach((set, index) => {
      let newSet = { ...set };
      if (mode === "easy") {
        newSet.weight = Math.max(0, Math.round((set.weight * 0.9) * 10) / 10);
      } else if (mode === "push") {
        newSet.weight = Math.round((set.weight + 2.5) * 10) / 10;
      }
      // Snap to nearest standard weight plate value
      newSet.weight = findNearestStandardValue(newSet.weight, STANDARD_WEIGHTS);
      newSet.reps = index === 0 ? 15 : (index === 1 ? 12 : 10);
      setsToRender.push(newSet);
    });
  } else if (type === "bodyweight") {
    if (logs.length > 0) {
      const lastLog = logs[logs.length - 1];
      const prevSets = lastLog.sets || [];
      const defaultReps = [12, 10, 8];
      const numSets = Math.max(prevSets.length, 3);
      for (let i = 0; i < numSets; i++) {
        const prevReps = prevSets[i]?.reps || defaultReps[i] || 8;
        let suggestedReps = prevReps;
        // Push → +1 rep per set | Easy → -1 rep per set | Normal → same reps
        if (mode === "push") suggestedReps = prevReps + 1;
        else if (mode === "easy") suggestedReps = Math.max(1, prevReps - 1);
        setsToRender.push({ reps: suggestedReps });
      }
      isFromHistory = true;
    } else {
      setsToRender = [
        { reps: 12 },
        { reps: 10 },
        { reps: 8 }
      ];
    }
  } else if (type === "cardio") {
    let sourceSets = [];
    if (logs.length > 0) {
      const lastLog = logs[logs.length - 1];
      sourceSets = (lastLog.sets || []).map(s => ({
        distance: Number(s.distance !== undefined ? s.distance : (s.km !== undefined ? s.km : 1.0)) || 1.0,
        time: Number(s.time !== undefined ? s.time : (s.reps || 10)) || 10
      }));
      isFromHistory = true;
    } else {
      sourceSets = defaultSetsByType(type);
    }
    sourceSets.forEach(set => {
      let newSet = { ...set };
      if (mode === "easy") {
        newSet.distance = Math.max(0.1, Math.round((set.distance * 0.8) * 100) / 100);
        newSet.time = Math.max(1, Math.round(set.time * 0.8));
      } else if (mode === "push") {
        newSet.distance = Math.round((set.distance * 1.1) * 100) / 100;
        newSet.time = Math.round(set.time * 1.1);
      }
      setsToRender.push(newSet);
    });
  }

  // 3. Render Set Input Elements
  // Check if this is a plank-style timed bodyweight exercise
  const isTimedExercise = ["plank", "wall sit", "hollow hold", "dead hang"].some(n =>
    (state.selectedExercise || '').toLowerCase().includes(n)
  );

  setsToRender.forEach((set, index) => {
    appendSetRow(type, set, index + 1, isTimedExercise);
  });

  // 4. Update helpers description
  const helperText = document.getElementById("setsHelperText");
  if (helperText) {
    if (isFromHistory) {
      if (mode === "easy") {
        helperText.textContent = "🔋 Light session targets pre-filled (-10% weight/reps).";
      } else if (mode === "push") {
        helperText.textContent = "🔥 Push session! Target pre-filled with progressive overload.";
      } else {
        helperText.textContent = "📋 Pre-filled from your last successful session.";
      }
    } else {
      helperText.textContent = "💪 No historical data found. Default targets suggested.";
    }
  }
}

function appendSetRow(type, values = {}, setNum, isTimedExercise = false) {
  const container = document.getElementById("setsList");
  if (!container) return;

  const row = document.createElement("div");
  row.className = "set-row";
  row.dataset.setNum = setNum;



  // Helper to create a select dropdown with standard values + Custom option
  function createStandardSelect(className, standardValues, currentValue, unit) {
    const wrapper = document.createElement("div");
    wrapper.className = "set-select-group";

    const select = document.createElement("select");
    select.className = className;

    // Add standard value options
    standardValues.forEach(v => {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = `${v}`;
      select.appendChild(opt);
    });

    // Add Custom option
    const customOpt = document.createElement("option");
    customOpt.value = "__custom__";
    customOpt.textContent = "Custom";
    select.appendChild(customOpt);

    // Custom input (hidden by default)
    const customWrap = document.createElement("div");
    customWrap.className = "custom-input-wrap";
    const customInput = document.createElement("input");
    customInput.type = "number";
    customInput.className = `${className}-custom`;
    customInput.step = unit === "kg" ? "0.5" : "1";
    customInput.min = "0";
    customInput.placeholder = `Custom ${unit || ""}`;
    customWrap.appendChild(customInput);

    // Set value — check if it matches a standard value
    if (currentValue !== undefined && currentValue !== "" && currentValue !== 0) {
      const numVal = Number(currentValue);
      if (standardValues.includes(numVal)) {
        select.value = numVal;
      } else {
        select.value = "__custom__";
        customWrap.classList.add("active");
        customInput.value = numVal;
      }
    } else {
      select.selectedIndex = 0;
    }

    // Toggle custom input visibility
    select.addEventListener("change", () => {
      if (select.value === "__custom__") {
        customWrap.classList.add("active");
        customInput.focus();
      } else {
        customWrap.classList.remove("active");
        customInput.value = "";
      }
    });

    wrapper.appendChild(select);
    wrapper.appendChild(customWrap);
    return wrapper;
  }

  // Set counter badge
  const numDiv = document.createElement("div");
  numDiv.style.flex = "0 0 45px";
  const numLabel = document.createElement("label");
  numLabel.textContent = "Set";
  const numInput = document.createElement("input");
  numInput.type = "text";
  numInput.value = `#${setNum}`;
  numInput.disabled = true;
  numInput.style.textAlign = "center";
  numInput.style.fontWeight = "700";
  numInput.style.color = "var(--accent)";
  numInput.style.background = "rgba(255, 140, 26, 0.05)";
  numInput.style.borderColor = "rgba(255, 140, 26, 0.15)";
  numDiv.appendChild(numLabel);
  numDiv.appendChild(numInput);
  row.appendChild(numDiv);

  if (type === "cardio") {
    // Distance Input
    const distDiv = document.createElement("div");
    const distLabel = document.createElement("label");
    distLabel.textContent = "Dist (km)";
    const distInput = document.createElement("input");
    distInput.type = "number";
    distInput.className = "set-distance";
    distInput.step = "0.01";
    distInput.min = "0";
    distInput.value = values.distance !== undefined ? values.distance : "";
    distInput.placeholder = "0.00";
    distDiv.appendChild(distLabel);
    distDiv.appendChild(distInput);
    row.appendChild(distDiv);

    // Time Input
    const timeDiv = document.createElement("div");
    const timeLabel = document.createElement("label");
    timeLabel.textContent = "Time (min)";
    const timeInput = document.createElement("input");
    timeInput.type = "number";
    timeInput.className = "set-time";
    timeInput.step = "1";
    timeInput.min = "0";
    timeInput.value = values.time !== undefined ? values.time : "";
    timeInput.placeholder = "0";
    timeDiv.appendChild(timeLabel);
    timeDiv.appendChild(timeInput);
    row.appendChild(timeDiv);
  } else if (type === "bodyweight") {
    if (isTimedExercise) {
      // Time (seconds) input for plank-style exercises
      const timeDiv = document.createElement("div");
      const timeLabel = document.createElement("label");
      timeLabel.textContent = "Time (sec)";
      const timeInput = document.createElement("input");
      timeInput.type = "number";
      timeInput.className = "set-time-sec";
      timeInput.dataset.field = "time";
      timeInput.step = "5";
      timeInput.min = "1";
      timeInput.value = values.time !== undefined ? values.time : (values.reps || 30);
      timeInput.placeholder = "30";
      timeDiv.appendChild(timeLabel);
      timeDiv.appendChild(timeInput);
      row.appendChild(timeDiv);
    } else {
      // Reps Dropdown
      const repsDiv = document.createElement("div");
      const repsLabel = document.createElement("label");
      repsLabel.textContent = "Reps";
      const repsSelect = createStandardSelect("set-reps", STANDARD_REPS, values.reps, "reps");
      repsDiv.appendChild(repsLabel);
      repsDiv.appendChild(repsSelect);
      row.appendChild(repsDiv);
    }
  } else {
    // Weighted — Weight Dropdown
    const wDiv = document.createElement("div");
    const wLabel = document.createElement("label");
    wLabel.textContent = `Weight (${state.unit})`;
    const weightSelect = createStandardSelect("set-weight", STANDARD_WEIGHTS, values.weight, state.unit);
    wDiv.appendChild(wLabel);
    wDiv.appendChild(weightSelect);
    row.appendChild(wDiv);

    // Reps Dropdown
    const repsDiv = document.createElement("div");
    const repsLabel = document.createElement("label");
    repsLabel.textContent = "Reps";
    const repsSelect = createStandardSelect("set-reps", STANDARD_REPS, values.reps, "reps");
    repsDiv.appendChild(repsLabel);
    repsDiv.appendChild(repsSelect);
    row.appendChild(repsDiv);
  }

  // Delete Action Button
  const delBtn = document.createElement("button");
  delBtn.className = "set-delete-btn";
  delBtn.innerHTML = "🗑";
  delBtn.type = "button";
  delBtn.addEventListener("click", () => {
    triggerHaptic(8);
    row.remove();
    reindexSets();
  });
  row.appendChild(delBtn);

  container.appendChild(row);
}

function reindexSets() {
  const rows = document.querySelectorAll("#setsList .set-row");
  rows.forEach((row, i) => {
    const numInput = row.querySelector("input[disabled]");
    if (numInput) {
      numInput.value = `#${i + 1}`;
    }
    row.dataset.setNum = i + 1;
  });
}

function addSet() {
  const typeSelect = document.getElementById("exerciseTypeSelect");
  if (!typeSelect) return;
  
  const type = typeSelect.value;
  const currentRows = document.querySelectorAll("#setsList .set-row");
  
  const isTimedEx = ['plank', 'wall sit', 'hollow hold', 'dead hang'].some(n =>
    (state.selectedExercise || '').toLowerCase().includes(n)
  );

  let defaultValues = {};
  if (currentRows.length > 0) {
    // Clone value from last row as standard starting target
    const lastRow = currentRows[currentRows.length - 1];
    if (type === "cardio") {
      defaultValues.distance = Number(lastRow.querySelector(".set-distance")?.value) || 0;
      defaultValues.time = Number(lastRow.querySelector(".set-time")?.value) || 0;
    } else if (type === "bodyweight") {
      if (isTimedEx) {
        defaultValues.time = Number(lastRow.querySelector(".set-time-sec")?.value) || 30;
      } else {
        defaultValues.reps = Number(lastRow.querySelector(".set-reps")?.value) || 0;
      }
    } else {
      defaultValues.weight = Number(lastRow.querySelector(".set-weight")?.value) || 0;
      defaultValues.reps = Number(lastRow.querySelector(".set-reps")?.value) || 0;
    }
  } else {
    const defaults = defaultSetsByType(type);
    defaultValues = defaults[0];
  }

  triggerHaptic(10);
  appendSetRow(type, defaultValues, currentRows.length + 1, isTimedEx);
}

function refreshExerciseStats() {
  // Fetch historical entries for this exercise
  const logs = state.entries.filter(e => 
    e.muscle === state.selectedMuscle && 
    normalizeName(e.exercise) === normalizeName(state.selectedExercise)
  );

  const best1RMEl = document.getElementById("statBest1RM");
  const lastTrainedEl = document.getElementById("statLastTrained");
  const volumeEl = document.getElementById("statTotalVolume");
  const current1RMEl = document.getElementById("current1RM");
  const lastTrainedExercise = document.getElementById("lastTrainedExercise");
  const lastSessionSummary = document.getElementById("lastSessionSummary");
  const suggestionSummary = document.getElementById("suggestionSummary");

  // Determine current metadata
  const exercises = getAllExercisesForMuscle(state.selectedMuscle);
  const currentMeta = exercises.find(ex => normalizeName(ex.name) === normalizeName(state.selectedExercise));
  const type = currentMeta ? currentMeta.type : "weighted";

  // Hide 1RM calculation panel if not weighted exercise type
  const current1RMPanel = document.getElementById("current1RMPanel");
  if (current1RMPanel) {
    if (type === "weighted") {
      current1RMPanel.classList.remove("focus-hidden");
    } else {
      current1RMPanel.classList.add("focus-hidden");
    }
  }

  if (logs.length === 0) {
    // Reset stats views
    if (best1RMEl) best1RMEl.textContent = "-";
    if (lastTrainedEl) lastTrainedEl.textContent = "Never";
    if (volumeEl) volumeEl.textContent = "0";
    if (current1RMEl) current1RMEl.textContent = "-";
    if (lastTrainedExercise) lastTrainedExercise.textContent = "Never trained yet.";
    if (lastSessionSummary) lastSessionSummary.textContent = "";
    if (suggestionSummary) suggestionSummary.textContent = "Complete your first log to trigger AI guidance!";
    
    // Hide chart card if empty
    const chartCard = document.getElementById("cardChart");
    if (chartCard) chartCard.style.display = "none";
    
    renderHistoryList([]);
    return;
  }

  // Active entries present, build recap summaries
  const latestLog = logs[logs.length - 1];
  
  if (lastTrainedEl) lastTrainedEl.textContent = formatDate(latestLog.date);
  if (lastTrainedExercise) lastTrainedExercise.textContent = formatDate(latestLog.date);

  let max1RM = 0;
  let totalSummedVolume = 0;

  logs.forEach(log => {
    if (log.best1RM > max1RM) max1RM = log.best1RM;
    if (type === "cardio") {
      totalSummedVolume += log.totalTime; // volume is total minutes
    } else if (type === "bodyweight") {
      totalSummedVolume += log.totalVolume; // volume is total reps
    } else {
      totalSummedVolume += log.totalVolume;
    }
  });

  if (best1RMEl) {
    best1RMEl.textContent = type === "weighted" ? `${max1RM} ${state.unit}` : "-";
  }

  if (volumeEl) {
    volumeEl.textContent = type === "cardio" ? `${latestLog.totalTime} min` : (type === "bodyweight" ? `${latestLog.totalVolume} reps` : `${latestLog.totalVolume} ${state.unit}`);
  }

  if (current1RMEl) {
    current1RMEl.textContent = type === "weighted" ? `${latestLog.best1RM} ${state.unit}` : "-";
  }

  // Build visual workout summaries in text blocks
  if (lastSessionSummary) {
    if (type === "cardio") {
      const distance = latestLog.sets.reduce((s, row) => s + (row.distance || 0), 0);
      const time = latestLog.sets.reduce((s, row) => s + (row.time || 0), 0);
      lastSessionSummary.textContent = `Completed: ${distance} km in ${time} mins total.`;
    } else if (type === "bodyweight") {
      const repsString = latestLog.sets.map(s => s.reps).join("-");
      lastSessionSummary.textContent = `Sets: [${repsString}] (${latestLog.totalVolume} reps)`;
    } else {
      const setStrings = latestLog.sets.map(s => `${s.weight}${state.unit}x${s.reps}`).join(", ");
      lastSessionSummary.textContent = `Last: [${setStrings}] • Vol: ${latestLog.totalVolume}${state.unit}`;
    }
  }

  // Suggest dynamic overload guidance
  if (suggestionSummary) {
    if (type === "cardio") {
      suggestionSummary.textContent = "🎯 Run longer! Aim for +5% duration or distance today.";
    } else if (type === "bodyweight") {
      const lastReps = latestLog.sets[0]?.reps || 8;
      suggestionSummary.textContent = `🎯 Aim for [${lastReps + 1}-${lastReps}-${lastReps}] reps to beat your past performance!`;
    } else {
      const topSet = latestLog.sets.sort((a,b) => b.weight - a.weight)[0];
      const nextTargetWeight = topSet.weight + (state.unit === "kg" ? 2.5 : 5);
      suggestionSummary.textContent = `🎯 Suggested overloading: Try ${nextTargetWeight}${state.unit} for ${Math.max(5, topSet.reps - 2)} reps!`;
    }
  }

  // Render analytics trends graph
  const chartCard = document.getElementById("cardChart");
  if (chartCard) {
    if (!state.focusMode) {
      chartCard.style.display = "block";
      buildProgressChart(logs, type);
    } else {
      chartCard.style.display = "none";
    }
  }

  renderHistoryList(logs);
}

function renderHistoryList(logs) {
  const container = document.getElementById("historyList");
  if (!container) return;

  container.innerHTML = "";

  if (logs.length === 0) {
    container.innerHTML = `<div class="small-text" style="color:var(--text-muted);">No entries yet. Add your workout below!</div>`;
    return;
  }

  // Reverse list to show newest on top
  const sortedLogs = [...logs].sort((a, b) => new Date(b.date) - new Date(a.date));

  sortedLogs.forEach(log => {
    const item = document.createElement("div");
    item.className = "history-item";

    const header = document.createElement("div");
    header.className = "history-header";

    const dateSpan = document.createElement("span");
    dateSpan.className = "history-title";
    dateSpan.textContent = formatDate(log.date);

    const actions = document.createElement("div");
    actions.className = "history-actions";

    // Edit button
    const editBtn = document.createElement("button");
    editBtn.innerHTML = "✏️";
    editBtn.className = "edit-btn";
    editBtn.title = "Edit this session entry";
    editBtn.addEventListener("click", () => {
      editPastEntry(log);
    });

    const delBtn = document.createElement("button");
    delBtn.innerHTML = "🗑";
    delBtn.title = "Delete this session entry";
    delBtn.addEventListener("click", () => {
      deleteSessionEntry(log.date, log.exercise);
    });

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);
    header.appendChild(dateSpan);
    header.appendChild(actions);

    const details = document.createElement("div");
    details.className = "history-sets";

    if (log.type === "cardio") {
      const setStrings = log.sets.map((s, idx) => `Set ${idx + 1}: ${s.distance}km in ${s.time}m`).join("<br>");
      details.innerHTML = setStrings;
    } else if (log.type === "bodyweight") {
      const setStrings = log.sets.map((s, idx) => `Set ${idx + 1}: ${s.reps} reps`).join("<br>");
      details.innerHTML = setStrings;
    } else {
      const setStrings = log.sets.map((s, idx) => `Set ${idx + 1}: ${s.weight}${state.unit} x ${s.reps} reps (1RM ~${calculate1RM(s.weight, s.reps)}${state.unit})`).join("<br>");
      details.innerHTML = setStrings;
    }

    item.appendChild(header);
    item.appendChild(details);
    container.appendChild(item);
  });
}

// Edit a past exercise entry — loads it into Step 3 form for modification
function editPastEntry(log) {
  triggerHaptic(5);
  
  // Set muscle and exercise context
  state.selectedMuscle = log.muscle;
  state.selectedExercise = log.exercise;
  state.originalEditingExercise = log.exercise; // Track original name
  
  // Navigate to workout view with the exercise pre-selected
  initWorkoutLoggingView(log.exercise);
  
  // Wait for the view to render, then override the date and sets
  setTimeout(() => {
    // Set edit mode flag and change save button text!
    state.isEditing = true;

    // Hide standard select controls, show inline text editor
    const editExInput = document.getElementById("editExerciseInput");
    const exerciseSelect = document.getElementById("exerciseSelect");
    const btnRename = document.getElementById("btnRenameExercise");
    const btnAdd = document.getElementById("btnAddExercise");
    const btnDel = document.getElementById("btnDeleteExercise");

    if (exerciseSelect) {
      exerciseSelect.style.display = "block";
      exerciseSelect.value = log.exercise;
    }
    if (editExInput) {
      editExInput.style.display = "none";
      editExInput.value = log.exercise;
    }
    if (btnRename) {
      btnRename.style.display = "block";
    }
    if (btnAdd) btnAdd.style.display = "block";
    if (btnDel) btnDel.style.display = "block";

    const btnSave = document.getElementById("btnSaveWorkout");
    if (btnSave) {
      btnSave.innerHTML = "💾 save edited entry";
    }

    // Set the date
    const dateInput = document.getElementById("sessionDate");
    if (dateInput) dateInput.value = log.date;
    
    // Set the exercise type
    const typeSelect = document.getElementById("exerciseTypeSelect");
    if (typeSelect) typeSelect.value = log.type;
    
    // Clear current sets and rebuild with the log's sets
    const setsList = document.getElementById("setsList");
    if (setsList) setsList.innerHTML = "";
    
    if (log.sets && log.sets.length > 0) {
      log.sets.forEach((s, idx) => {
        appendSetRow(log.type, s, idx + 1);
      });
    }
  }, 100);
}

// Delete Log Entries
function deleteSessionEntry(dateStr, exerciseName) {
  if (!confirm(`Permanently delete this workout entry for ${exerciseName} on ${formatDate(dateStr)}?`)) {
    return;
  }

  triggerHaptic(20);

  state.entries = state.entries.filter(e => 
    !(e.date === dateStr && normalizeName(e.exercise) === normalizeName(exerciseName))
  );

  saveAllData();
  refreshExerciseStats();
  updateMuscleLastTrainedUI();
}

// Progressive Overload Chart Render
function buildProgressChart(logs, type) {
  const canvas = document.getElementById("progressChart");
  if (!canvas) return;

  if (state.chartInstance) {
    state.chartInstance.destroy();
  }

  const ctx = canvas.getContext("2d");

  // Keep latest 5 sessions to avoid crowded visual graphs on mobile
  const subset = logs.slice(-5);

  const labels = subset.map(l => {
    const d = new Date(l.date);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  });

  const dataset1 = []; // Top Weight or Max reps or Distance
  const dataset2 = []; // 1RM or Time

  subset.forEach(log => {
    if (type === "cardio") {
      const totalDist = log.sets.reduce((sum, s) => sum + (s.distance || 0), 0);
      const totalTime = log.sets.reduce((sum, s) => sum + (s.time || 0), 0);
      dataset1.push(totalDist);
      dataset2.push(totalTime);
    } else if (type === "bodyweight") {
      const maxReps = Math.max(...log.sets.map(s => s.reps || 0));
      dataset1.push(maxReps);
    } else {
      const maxWeight = Math.max(...log.sets.map(s => s.weight || 0));
      dataset1.push(maxWeight);
      dataset2.push(log.best1RM);
    }
  });

  const datasets = [];

  // Create canvas neon gradients
  const gradientOrange = ctx.createLinearGradient(0, 0, 0, 200);
  gradientOrange.addColorStop(0, "rgba(255, 140, 26, 0.4)");
  gradientOrange.addColorStop(1, "rgba(255, 140, 26, 0.0)");

  const gradientTeal = ctx.createLinearGradient(0, 0, 0, 200);
  gradientTeal.addColorStop(0, "rgba(0, 229, 255, 0.4)");
  gradientTeal.addColorStop(1, "rgba(0, 229, 255, 0.0)");

  if (type === "cardio") {
    datasets.push({
      label: "Distance (km)",
      data: dataset1,
      borderColor: "#ff8c1a",
      backgroundColor: gradientOrange,
      borderWidth: 3,
      fill: true,
      tension: 0.35,
      pointBackgroundColor: "#ff8c1a",
      pointBorderColor: "#ffffff",
      pointHoverRadius: 6
    });
    datasets.push({
      label: "Time (min)",
      data: dataset2,
      borderColor: "#00e5ff",
      backgroundColor: gradientTeal,
      borderWidth: 3,
      fill: true,
      tension: 0.35,
      pointBackgroundColor: "#00e5ff",
      pointBorderColor: "#ffffff",
      pointHoverRadius: 6
    });
  } else if (type === "bodyweight") {
    datasets.push({
      label: "Max Reps",
      data: dataset1,
      borderColor: "#ff8c1a",
      backgroundColor: gradientOrange,
      borderWidth: 3,
      fill: true,
      tension: 0.35,
      pointBackgroundColor: "#ff8c1a",
      pointBorderColor: "#ffffff",
      pointHoverRadius: 6
    });
  } else {
    datasets.push({
      label: "Top Weight (kg)",
      data: dataset1,
      borderColor: "#ff8c1a",
      backgroundColor: gradientOrange,
      borderWidth: 3,
      fill: true,
      tension: 0.35,
      pointBackgroundColor: "#ff8c1a",
      pointBorderColor: "#ffffff",
      pointHoverRadius: 6
    });
    datasets.push({
      label: "Estimated 1RM (kg)",
      data: dataset2,
      borderColor: "#00e5ff",
      backgroundColor: gradientTeal,
      borderWidth: 3,
      fill: true,
      tension: 0.35,
      pointBackgroundColor: "#00e5ff",
      pointBorderColor: "#ffffff",
      pointHoverRadius: 6
    });
  }

  state.chartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: "top",
          labels: {
            color: "#8d94c0",
            font: { family: "Inter", weight: "600", size: 10 }
          }
        },
        tooltip: {
          backgroundColor: "rgba(10, 12, 34, 0.95)",
          titleColor: "#ffffff",
          bodyColor: "#f5f6fa",
          borderColor: "rgba(255, 140, 26, 0.3)",
          borderWidth: 1,
          padding: 10,
          cornerRadius: 8,
          bodyFont: { family: "Inter" }
        }
      },
      scales: {
        x: {
          grid: { color: "rgba(255, 255, 255, 0.03)" },
          ticks: { color: "#8d94c0", font: { size: 9 } }
        },
        y: {
          grid: { color: "rgba(255, 255, 255, 0.03)" },
          ticks: { color: "#8d94c0", font: { size: 9 } }
        }
      }
    }
  });
}

// Helper to read standard select dropdowns and support Custom option text input values
function readSetSelectValue(row, className) {
  const select = row.querySelector(`select.${className}`);
  if (!select) return 0;
  if (select.value === "__custom__") {
    const customInput = row.querySelector(`input.${className}-custom`);
    return Number(customInput ? customInput.value : 0) || 0;
  }
  return Number(select.value) || 0;
}

// Workout Log Savings
function saveWorkoutEntry() {
  const dateInput = document.getElementById("sessionDate");
  const saveError = document.getElementById("saveError");

  if (saveError) {
    saveError.style.display = "none";
    saveError.textContent = "";
  }

  if (!dateInput || !dateInput.value) {
    showSaveError("Date selection is required to track this attack.");
    return;
  }

  const dateStr = dateInput.value;
  const typeSelect = document.getElementById("exerciseTypeSelect");
  const type = typeSelect ? typeSelect.value : "weighted";

  // Parse set inputs from dropdowns
  const rows = document.querySelectorAll("#setsList .set-row");
  const parsedSets = [];

  let validationFailed = false;

  rows.forEach(row => {
    if (type === "cardio") {
      const distanceInput = row.querySelector(".set-distance");
      const timeInput = row.querySelector(".set-time");
      const dist = Number(distanceInput ? distanceInput.value : 0) || 0;
      const mins = Number(timeInput ? timeInput.value : 0) || 0;

      if (dist <= 0 && mins <= 0) {
        validationFailed = true;
        if (distanceInput) distanceInput.focus();
      } else {
        parsedSets.push({ distance: dist, time: mins });
      }
    } else if (type === "bodyweight") {
      const reps = readSetSelectValue(row, "set-reps");

      if (reps <= 0) {
        validationFailed = true;
      } else {
        parsedSets.push({ reps });
      }
    } else {
      const weight = readSetSelectValue(row, "set-weight");
      const reps = readSetSelectValue(row, "set-reps");

      if (weight < 0 || reps <= 0) {
        validationFailed = true;
      } else {
        parsedSets.push({ weight, reps });
      }
    }
  });

  if (validationFailed) {
    showSaveError("Please complete all sets values (non-zero positive digits) or remove unnecessary empty sets.");
    return;
  }

  if (parsedSets.length === 0) {
    showSaveError("Please log at least one target set row for this exercise session.");
    return;
  }

  // Read edited exercise name from text input if activated, otherwise read from standard select dropdown
  if (state.isEditing) {
    const editInput = document.getElementById("editExerciseInput");
    const exerciseSelect = document.getElementById("exerciseSelect");
    
    if (editInput && editInput.style.display !== "none" && editInput.value.trim()) {
      const newName = editInput.value.trim();
      const oldName = state.originalEditingExercise || state.selectedExercise;
      
      if (normalizeName(newName) !== normalizeName(oldName)) {
        state.selectedExercise = newName;
        
        // Sync the renamed exercise name directly in custom exercises library!
        const muscle = state.selectedMuscle;
        if (!state.customExercises[muscle]) {
          state.customExercises[muscle] = [];
        }
        
        const targetIdx = state.customExercises[muscle].findIndex(c => normalizeName(c.name) === normalizeName(oldName));
        if (targetIdx !== -1) {
          // If no other logs in history reference the old name, we rename it directly in library!
          const otherEntriesExist = state.entries.some(e => 
            !(e.date === dateStr && e.muscle === muscle && normalizeName(e.exercise) === normalizeName(oldName)) &&
            normalizeName(e.exercise) === normalizeName(oldName)
          );
          
          if (!otherEntriesExist) {
            state.customExercises[muscle][targetIdx].name = newName;
          } else {
            // Otherwise, keep the old one and add the new one to the library
            const exists = state.customExercises[muscle].some(ex => normalizeName(ex.name) === normalizeName(newName));
            if (!exists) {
              state.customExercises[muscle].push({
                name: newName,
                type: type
              });
            }
          }
        } else {
          // Add new name to the custom exercises library if it wasn't there
          const exists = state.customExercises[muscle].some(ex => normalizeName(ex.name) === normalizeName(newName));
          if (!exists) {
            state.customExercises[muscle].push({
              name: newName,
              type: type
            });
          }
        }
      }
    } else if (exerciseSelect) {
      // User kept the dropdown or selected a different exercise from the dropdown
      state.selectedExercise = exerciseSelect.value;
    }
  }

  // Trigger positive success feedback
  triggerHaptic([30, 20, 30]);

  const computed = computeFromSets(parsedSets, type);
  const newEntry = {
    date: dateStr,
    muscle: state.selectedMuscle,
    exercise: state.selectedExercise,
    type: type,
    sets: parsedSets,
    totalVolume: computed.totalVolume,
    topWeight: computed.topWeight,
    best1RM: computed.best1RM,
    totalDistance: computed.totalDistance,
    totalTime: computed.totalTime
  };

  // Remove existing duplicate entry (using original name if edited to avoid duplicates)
  const oldExName = state.originalEditingExercise || state.selectedExercise;
  state.entries = state.entries.filter(e => 
    !(e.date === dateStr && 
      e.muscle === state.selectedMuscle && 
      normalizeName(e.exercise) === normalizeName(oldExName))
  );
  state.originalEditingExercise = null; // Reset original editing name

  state.entries.push(newEntry);
  state.entries.sort((a, b) => new Date(a.date) - new Date(b.date));

  saveAllData();
  
  // Show standard visual success banner animation on saving
  const btnSave = document.getElementById("btnSaveWorkout");
  if (btnSave) {
    btnSave.innerHTML = state.isEditing ? "🎉 EDIT SAVED!" : "🎉 ATTACK SAVED!";
    btnSave.className = "btn btn-success";
    btnSave.disabled = true;
    setTimeout(() => {
      btnSave.innerHTML = "🚀 Save Active Workout Log";
      btnSave.className = "btn btn-primary";
      btnSave.disabled = false;
      state.isEditing = false; // Turn off editing mode
      // Navigate to Step 2 (recap view) after save
      initRecapView();
    }, 1200);
  }

  refreshExerciseStats();
  updateMuscleLastTrainedUI();
}

function showSaveError(msg) {
  triggerHaptic([50, 50]);
  const err = document.getElementById("saveError");
  if (err) {
    err.textContent = msg;
    err.style.display = "block";
  }
}

// Complete Workout for This Muscle
function completeWorkout() {
  triggerHaptic([40, 30, 40, 30, 50]);
  
  // Calculate total workout metrics for the summary screen
  const today = new Date().toISOString().split("T")[0];
  const activeEntries = state.entries.filter(e => e.muscle === state.selectedMuscle && e.date === today && e.exercise !== "__muscle_complete__");

  if (activeEntries.length === 0) {
    // Just return to muscles view if no logs were saved today
    switchView("view-muscles");
    return;
  }

  // Create a special complete marker in state logs
  const completeMarker = {
    date: today,
    muscle: state.selectedMuscle,
    exercise: "__muscle_complete__",
    type: "meta",
    sets: []
  };

  state.entries = state.entries.filter(e => 
    !(e.date === today && e.muscle === state.selectedMuscle && e.exercise === "__muscle_complete__")
  );

  state.entries.push(completeMarker);
  saveAllData();
  updateMuscleLastTrainedUI();

  // Render a gorgeous overlay complete screen!
  renderWorkoutSummaryScreen(activeEntries);
}

function renderWorkoutSummaryScreen(activeEntries) {
  // Let's dynamically inject a beautiful summary view
  let summaryView = document.getElementById("view-summary");
  if (!summaryView) {
    summaryView = document.createElement("div");
    summaryView.id = "view-summary";
    summaryView.className = "view card";
    document.querySelector(".app").appendChild(summaryView);
  }

  let totalVolume = 0;
  let totalSets = 0;
  let summaryHTML = "";

  activeEntries.forEach(entry => {
    totalSets += entry.sets.length;
    if (entry.type === "weighted") {
      totalVolume += entry.totalVolume;
    }
  });

  const quotes = [
    "Overload is the law of growth. Attack completed successfully!",
    "No shortcuts. No mercy. The muscle has been destroyed and rebuilt.",
    "Adrenaline is the catalyst. You fought, you conquered, you grew.",
    "Champions don't count the days, they make the days count. Outstanding session!"
  ];
  const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];

  summaryHTML = `
    <div class="summary-screen">
      <div class="summary-icon">🔥</div>
      <div class="summary-title">Battlefield Conquered!</div>
      <div class="summary-quote">"${randomQuote}"</div>
      
      <div class="card-header" style="justify-content:center;margin-top:16px;">
        <span class="chip" style="background:rgba(0, 230, 118, 0.1);color:var(--success);border-color:rgba(0,230,118,0.25);">
          ${state.selectedMuscle} Conquered
        </span>
      </div>

      <div class="stats-row" style="margin:20px 0;">
        <div class="stat">
          <div class="stat-label">Exercises Done</div>
          <div class="stat-value info">${activeEntries.length}</div>
        </div>
        <div class="stat">
          <div class="stat-label">Total Sets Hit</div>
          <div class="stat-value success">${totalSets}</div>
        </div>
        ${totalVolume > 0 ? `
        <div class="stat">
          <div class="stat-label">Total Volume Lifted</div>
          <div class="stat-value" style="color:var(--accent);">${totalVolume} kg</div>
        </div>` : ""}
      </div>

      <div style="margin-top:24px;display:flex;flex-direction:column;gap:10px;">
        <button id="btnDismissSummary" class="btn btn-primary" style="width:100%;">
          ⚔️ Head Back to Choose Battlefield
        </button>
      </div>
    </div>
  `;

  summaryView.innerHTML = summaryHTML;
  
  // Bind completion button dismissal
  const dismissBtn = summaryView.querySelector("#btnDismissSummary");
  if (dismissBtn) {
    dismissBtn.addEventListener("click", () => {
      switchView("view-muscles");
    });
  }

  switchView("view-summary");
}

// Add Custom Exercises
function showAddExerciseUI() {
  triggerHaptic(5);
  const inputField = document.getElementById("newExerciseInput");
  const confirmBtn = document.getElementById("btnConfirmAddExercise");
  
  if (inputField && confirmBtn) {
    const isHidden = inputField.style.display === "none";
    inputField.style.display = isHidden ? "block" : "none";
    confirmBtn.style.display = isHidden ? "block" : "none";
    if (isHidden) inputField.focus();
  }
}

function confirmAddExercise() {
  const input = document.getElementById("newExerciseInput");
  if (!input) return;

  const rawName = input.value.trim();
  if (!rawName) return;

  const currentTypeSelect = document.getElementById("exerciseTypeSelect");
  const type = currentTypeSelect ? currentTypeSelect.value : "weighted";

  const exercises = getAllExercisesForMuscle(state.selectedMuscle);
  const match = exercises.find(ex => normalizeName(ex.name) === normalizeName(rawName));

  if (match) {
    alert(`The exercise "${rawName}" already exists on this battlefield.`);
    return;
  }

  triggerHaptic([20, 20]);

  // Append new custom exercises
  if (!state.customExercises[state.selectedMuscle]) {
    state.customExercises[state.selectedMuscle] = [];
  }

  state.customExercises[state.selectedMuscle].push({
    name: rawName,
    type: type
  });

  saveAllData();
  
  input.value = "";
  input.style.display = "none";
  document.getElementById("btnConfirmAddExercise").style.display = "none";

  rebuildExerciseSelect(rawName);
}

function deleteCustomExercise() {
  const select = document.getElementById("exerciseSelect");
  if (!select || !select.value) return;

  const selectedName = select.value;
  
  const hasHistory = state.entries.some(entry => 
    entry.muscle === state.selectedMuscle && 
    normalizeName(entry.exercise) === normalizeName(selectedName)
  );

  let msg = `Permanently delete the exercise "${selectedName}" from your database? This will NOT delete past logs.`;
  if (hasHistory) {
    msg = `⚠️ WARNING: You have active workout logs in your history for "${selectedName}"!\n\nDeleting it will remove it from this selection dropdown, but your past logs will still remain. Do you want to proceed?`;
  }

  if (!confirm(msg)) {
    return;
  }

  triggerHaptic(20);

  if (state.customExercises[state.selectedMuscle]) {
    state.customExercises[state.selectedMuscle] = state.customExercises[state.selectedMuscle].filter(ex => 
      normalizeName(ex.name) !== normalizeName(selectedName)
    );
  }

  saveAllData();
  rebuildExerciseSelect();
}

// Copy Last Sets Quick Actions
function copyLastWorkoutSets() {
  const logs = state.entries.filter(e => 
    e.muscle === state.selectedMuscle && 
    normalizeName(e.exercise) === normalizeName(state.selectedExercise)
  );

  if (logs.length === 0) {
    alert("No previous logs exist for this exercise. Pre-filling with default configurations!");
    return;
  }

  triggerHaptic(15);
  const sourceSets = logs[logs.length - 1].sets || [];
  const typeSelect = document.getElementById("exerciseTypeSelect");
  const type = typeSelect ? typeSelect.value : "weighted";

  const listContainer = document.getElementById("setsList");
  if (listContainer) listContainer.innerHTML = "";

  sourceSets.forEach((set, index) => {
    appendSetRow(type, set, index + 1);
  });

  const helperText = document.getElementById("setsHelperText");
  if (helperText) {
    helperText.textContent = "📋 Successfully copied exact sets from the previous session.";
  }
}

// Focus Mode Toggle (distraction-free logger)
function toggleFocusMode() {
  state.focusMode = !state.focusMode;
  triggerHaptic(5);

  // Toggle focus-active body class for breathing ambient edge glow
  if (state.focusMode) {
    document.body.classList.add("focus-active");
  } else {
    document.body.classList.remove("focus-active");
  }

  const focusBtn = document.getElementById("btnFocusMode");
  const hCard = document.getElementById("cardHistory");
  const cCard = document.getElementById("cardChart");

  if (focusBtn) {
    focusBtn.innerHTML = state.focusMode ? "🎯 Focus: On" : "🎯 Focus: Off";
    focusBtn.className = state.focusMode ? "btn btn-cyan btn-sm" : "btn btn-secondary btn-sm";
  }

  if (hCard) {
    if (state.focusMode) hCard.classList.add("focus-hidden");
    else hCard.classList.remove("focus-hidden");
  }

  if (cCard) {
    if (state.focusMode) cCard.classList.add("focus-hidden");
    else cCard.classList.remove("focus-hidden");
  }

  // Redraw progress graph if turning off focus mode
  if (!state.focusMode) {
    refreshExerciseStats();
  }
}

// Date-wise History View Manager
let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth();

function initDateHistoryView() {
  const dateInput = document.getElementById("dateHistoryInput");
  if (dateInput) {
    // Defaults to today's local date
    const today = new Date();
    const offset = today.getTimezoneOffset();
    const localToday = new Date(today.getTime() - (offset * 60 * 1000));
    dateInput.value = localToday.toISOString().split("T")[0];
    
    // Set custom calendar view defaults to today's month/year
    calYear = today.getFullYear();
    calMonth = today.getMonth();
  }

  renderCustomCalendar();
  renderDatewiseHistory();
  switchView("view-date-history");
}

function renderCustomCalendar() {
  const container = document.getElementById("inlineCalendar");
  if (!container) return;
  container.innerHTML = "";

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  // Unique dates from entries containing active logs
  const activeDates = new Set(
    state.entries
      .filter(e => e.exercise !== "__muscle_complete__")
      .map(e => e.date)
  );

  const selectedDate = document.getElementById("dateHistoryInput")?.value || "";

  // Days in month calculations
  const firstDayIndex = new Date(calYear, calMonth, 1).getDay(); // 0 (Sun) to 6 (Sat)
  const totalDays = new Date(calYear, calMonth + 1, 0).getDate();

  // Create Header
  const header = document.createElement("div");
  header.className = "cal-header";
  header.innerHTML = `
    <button class="cal-nav-btn" id="calPrevBtn">◀</button>
    <span>${monthNames[calMonth]} ${calYear}</span>
    <button class="cal-nav-btn" id="calNextBtn">▶</button>
  `;
  container.appendChild(header);

  // Bind header buttons
  header.querySelector("#calPrevBtn").addEventListener("click", () => {
    triggerHaptic(5);
    calMonth--;
    if (calMonth < 0) {
      calMonth = 11;
      calYear--;
    }
    renderCustomCalendar();
  });

  header.querySelector("#calNextBtn").addEventListener("click", () => {
    triggerHaptic(5);
    calMonth++;
    if (calMonth > 11) {
      calMonth = 0;
      calYear++;
    }
    renderCustomCalendar();
  });

  // Create Grid
  const grid = document.createElement("div");
  grid.className = "cal-grid";

  // Weekday labels
  const weekdays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  weekdays.forEach(day => {
    const el = document.createElement("div");
    el.className = "cal-weekday";
    el.textContent = day;
    grid.appendChild(el);
  });

  // Empty cells for padding
  for (let i = 0; i < firstDayIndex; i++) {
    const el = document.createElement("div");
    el.className = "cal-day empty-day";
    grid.appendChild(el);
  }

  // Month days
  for (let day = 1; day <= totalDays; day++) {
    const el = document.createElement("div");
    el.className = "cal-day";
    el.textContent = day;

    // Get date string YYYY-MM-DD local format
    const mStr = String(calMonth + 1).padStart(2, "0");
    const dStr = String(day).padStart(2, "0");
    const dayDateStr = `${calYear}-${mStr}-${dStr}`;

    const hasLogs = activeDates.has(dayDateStr);
    const isSelected = dayDateStr === selectedDate;

    if (hasLogs) el.classList.add("has-logs");
    if (isSelected) el.classList.add("selected-day");

    el.addEventListener("click", () => {
      triggerHaptic(10);
      const dateInput = document.getElementById("dateHistoryInput");
      if (dateInput) {
        dateInput.value = dayDateStr;
      }
      renderCustomCalendar();
      renderDatewiseHistory();
    });

    grid.appendChild(el);
  }

  container.appendChild(grid);
}

function renderDatewiseHistory() {
  const dateInput = document.getElementById("dateHistoryInput");
  const summary = document.getElementById("dateHistorySummary");
  const container = document.getElementById("dateHistoryList");

  if (!dateInput || !summary || !container) return;

  const targetDate = dateInput.value;
  container.innerHTML = "";

  if (!targetDate) {
    summary.textContent = "Please select a date to analyze history logs.";
    return;
  }

  const logs = state.entries.filter(e => e.date === targetDate);
  const completions = logs.filter(l => l.exercise === "__muscle_complete__");
  const activeWorkouts = logs.filter(l => l.exercise !== "__muscle_complete__");

  if (activeWorkouts.length === 0) {
    summary.textContent = `No workouts completed on ${formatDate(targetDate)}. Keep active!`;
    container.innerHTML = `
      <div class="small-text" style="text-align:center;padding:40px 0;color:var(--text-muted);">
        🏖️ Rest Day. No active logs discovered.
      </div>`;
    return;
  }

  // Update summary header
  const completedMuscles = Array.from(new Set(completions.map(c => c.muscle))).join(", ") || "None";
  summary.innerHTML = `Conquered: <strong>${activeWorkouts.length} exercises</strong> across <strong>${Array.from(new Set(activeWorkouts.map(w => w.muscle))).length} muscle battlefield(s)</strong>. Completion targets met: [${completedMuscles}].`;

  // Group workout logs by muscle groups
  const grouped = {};
  activeWorkouts.forEach(log => {
    if (!grouped[log.muscle]) grouped[log.muscle] = [];
    grouped[log.muscle].push(log);
  });

  for (const muscle in grouped) {
    const section = document.createElement("div");
    section.style.marginBottom = "14px";

    const label = document.createElement("label");
    label.textContent = muscle;
    label.style.color = "var(--accent)";
    label.style.fontWeight = "700";
    label.style.borderBottom = "1px solid rgba(255, 140, 26, 0.15)";
    label.style.paddingBottom = "4px";
    label.style.marginBottom = "8px";
    section.appendChild(label);

    grouped[muscle].forEach(log => {
      const item = document.createElement("div");
      item.className = "date-history-item";

      const header = document.createElement("div");
      header.className = "date-history-header";

      const title = document.createElement("span");
      title.className = "date-history-title";
      title.textContent = log.exercise;

      const typeBadge = document.createElement("span");
      typeBadge.className = "chip";
      typeBadge.style.fontSize = "0.6rem";
      typeBadge.style.padding = "2px 8px";
      typeBadge.textContent = log.type;

      header.appendChild(title);
      header.appendChild(typeBadge);

      const setsDiv = document.createElement("div");
      setsDiv.className = "date-history-sets";

      if (log.type === "cardio") {
        const setStrings = log.sets.map((s, idx) => `Set ${idx + 1}: ${s.distance} km in ${s.time} mins`).join("<br>");
        setsDiv.innerHTML = setStrings;
      } else if (log.type === "bodyweight") {
        const setStrings = log.sets.map((s, idx) => `Set ${idx + 1}: ${s.reps} reps`).join("<br>");
        setsDiv.innerHTML = setStrings;
      } else {
        const setStrings = log.sets.map((s, idx) => `Set ${idx + 1}: ${s.weight} ${state.unit} x ${s.reps} reps`).join("<br>");
        setsDiv.innerHTML = setStrings;
      }

      item.appendChild(header);
      item.appendChild(setsDiv);
      section.appendChild(item);
    });

    container.appendChild(section);
  }
}

// Body Weight Analytics Screen Manager
function initBodyweightView() {
  const dateInput = document.getElementById("bodyweightDate");
  const weightInput = document.getElementById("bodyweightInput");
  const err = document.getElementById("bodyweightError");

  if (dateInput) {
    const today = new Date();
    const offset = today.getTimezoneOffset();
    const localToday = new Date(today.getTime() - (offset * 60 * 1000));
    dateInput.value = localToday.toISOString().split("T")[0];
  }
  if (weightInput) weightInput.value = "";
  if (err) err.style.display = "none";

  renderBodyweightDashboard();
  switchView("view-bodyweight");
}

function renderBodyweightDashboard() {
  const latestEl = document.getElementById("bwLatest");
  const prevEl = document.getElementById("bwPrevious");
  const changeEl = document.getElementById("bwChange");
  const avgEl = document.getElementById("bwAverage");
  const listContainer = document.getElementById("bodyweightHistoryList");

  if (!latestEl || !prevEl || !changeEl || !avgEl || !listContainer) return;

  listContainer.innerHTML = "";

  if (state.bodyweightEntries.length === 0) {
    latestEl.textContent = "-";
    prevEl.textContent = "-";
    changeEl.textContent = "-";
    changeEl.style.color = "var(--text-main)";
    avgEl.textContent = "-";
    listContainer.innerHTML = `<div class="small-text" style="color:var(--text-muted);text-align:center;padding:20px 0;">No weight logs found. Create your target weight today!</div>`;
    return;
  }

  // 1. Render Metrics Dashboard
  const sorted = [...state.bodyweightEntries].sort((a,b) => new Date(a.date) - new Date(b.date));
  const latest = sorted[sorted.length - 1];
  const previous = sorted.length > 1 ? sorted[sorted.length - 2] : null;

  latestEl.textContent = `${latest.weight} ${state.unit}`;
  
  if (previous) {
    prevEl.textContent = `${previous.weight} ${state.unit}`;
    const diff = Math.round((latest.weight - previous.weight) * 10) / 10;
    
    if (diff > 0) {
      changeEl.textContent = `+${diff} ${state.unit}`;
      changeEl.style.color = "var(--danger)"; // dynamic weight gain indicator
    } else if (diff < 0) {
      changeEl.textContent = `${diff} ${state.unit}`;
      changeEl.style.color = "var(--success)"; // weight loss indicator
    } else {
      changeEl.textContent = `0.0 ${state.unit}`;
      changeEl.style.color = "var(--text-main)";
    }
  } else {
    prevEl.textContent = "-";
    changeEl.textContent = "-";
    changeEl.style.color = "var(--text-main)";
  }

  // 7-entry moving average calculation
  const subsetForAvg = sorted.slice(-7);
  const sumAvg = subsetForAvg.reduce((sum, item) => sum + item.weight, 0);
  const avgVal = Math.round((sumAvg / subsetForAvg.length) * 100) / 100;
  avgEl.textContent = `${avgVal} ${state.unit}`;

  // 2. Render Weights History Log
  const newestOnTop = [...state.bodyweightEntries].sort((a,b) => new Date(b.date) - new Date(a.date));

  newestOnTop.forEach(entry => {
    const item = document.createElement("div");
    item.className = "bodyweight-item";

    const header = document.createElement("div");
    header.className = "bodyweight-header";

    const dateSpan = document.createElement("span");
    dateSpan.className = "history-title";
    dateSpan.textContent = formatDate(entry.date);

    const weightValSpan = document.createElement("span");
    weightValSpan.style.fontWeight = "700";
    weightValSpan.style.color = "var(--cyan)";
    weightValSpan.textContent = `${entry.weight} ${state.unit}`;

    const delBtn = document.createElement("button");
    delBtn.className = "set-delete-btn";
    delBtn.style.width = "28px";
    delBtn.style.height = "28px";
    delBtn.style.fontSize = "0.75rem";
    delBtn.innerHTML = "🗑";
    delBtn.addEventListener("click", () => {
      deleteBodyweightLog(entry.date);
    });

    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.alignItems = "center";
    actions.style.gap = "12px";

    actions.appendChild(weightValSpan);
    actions.appendChild(delBtn);

    header.appendChild(dateSpan);
    header.appendChild(actions);
    item.appendChild(header);

    listContainer.appendChild(item);
  });
}

function saveBodyweightLog() {
  const dateInput = document.getElementById("bodyweightDate");
  const weightInput = document.getElementById("bodyweightInput");
  const err = document.getElementById("bodyweightError");

  if (err) {
    err.style.display = "none";
    err.textContent = "";
  }

  if (!dateInput || !dateInput.value || !weightInput || !weightInput.value) {
    showBodyweightError("Both date and valid weight values are required.");
    return;
  }

  const dateStr = dateInput.value;
  const wt = Number(weightInput.value);

  if (wt <= 0) {
    showBodyweightError("Body weight must be a positive non-zero digit.");
    return;
  }

  triggerHaptic([30, 20]);

  // Remove existing entries on that date to prevent duplicates
  state.bodyweightEntries = state.bodyweightEntries.filter(b => b.date !== dateStr);

  state.bodyweightEntries.push({ date: dateStr, weight: wt });
  state.bodyweightEntries.sort((a, b) => new Date(b.date) - new Date(a.date));

  saveAllData();
  
  if (weightInput) weightInput.value = "";
  
  renderBodyweightDashboard();
}

function deleteBodyweightLog(dateStr) {
  if (!confirm(`Permanently delete body weight logs for ${formatDate(dateStr)}?`)) {
    return;
  }

  triggerHaptic(20);
  state.bodyweightEntries = state.bodyweightEntries.filter(b => b.date !== dateStr);
  saveAllData();
  renderBodyweightDashboard();
}

function showBodyweightError(msg) {
  triggerHaptic([50, 50]);
  const err = document.getElementById("bodyweightError");
  if (err) {
    err.textContent = msg;
    err.style.display = "block";
  }
}

// App Title Inline Editing
function toggleHeadlineEdit() {
  triggerHaptic(5);
  const row = document.getElementById("headlineEditRow");
  const input = document.getElementById("headlineInput");
  
  if (row && input) {
    const isHidden = window.getComputedStyle(row).display === "none";
    row.style.display = isHidden ? "flex" : "none";
    if (isHidden) {
      input.value = state.headline;
      input.focus();
    }
  }
}

function saveHeadlineTitle() {
  const input = document.getElementById("headlineInput");
  if (!input) return;

  const rawTitle = input.value.trim();
  if (!rawTitle) return;

  triggerHaptic([20, 20]);
  state.headline = rawTitle;
  saveAllData();

  const titleEl = document.getElementById("headlineText");
  if (titleEl) titleEl.textContent = state.headline;

  document.getElementById("headlineEditRow").style.display = "none";
}

function cancelHeadlineTitle() {
  triggerHaptic(5);
  document.getElementById("headlineEditRow").style.display = "none";
}

// Reset Database Functions
async function confirmResetAllData() {
  triggerHaptic([100, 100, 100]);
  
  // Wipe all LocalStorage keys
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(CUSTOM_EXER_KEY);
  localStorage.removeItem(HEADLINE_KEY);
  localStorage.removeItem(BODYWEIGHT_KEY);
  localStorage.removeItem(MODE_KEY);
  localStorage.removeItem("gym-tracker-theme");
  localStorage.removeItem(UNIT_KEY);
  localStorage.removeItem("gym-tracker-defaults-loaded");

  // Wipe all IndexedDB keys
  await db.remove(STORAGE_KEY);
  await db.remove(CUSTOM_EXER_KEY);
  await db.remove(HEADLINE_KEY);
  await db.remove(BODYWEIGHT_KEY);
  await db.remove(MODE_KEY);
  await db.remove("gym-tracker-theme");
  await db.remove(UNIT_KEY);
  await db.remove("gym-tracker-defaults-loaded");

  // Re-initialize state
  state = {
    selectedMuscle: null,
    selectedExercise: null,
    entries: [],
    customExercises: {},
    bodyweightEntries: [],
    headline: "Adrenaline Forge: All‑Out Mode",
    mode: "normal",
    focusMode: false,
    chartInstance: null,
    theme: "orange",
    synthPlaying: false,
    unit: "kg"
  };

  // Rebuild defaults
  saveAllData();
  await loadAllData();
  initApp();
  switchView("view-muscles");
}

// Import & Export JSON Logic
function exportWorkoutData() {
  triggerHaptic(10);
  
  const payload = {
    app: "AdrenalineForge",
    version: "2.0.0",
    exportedAt: new Date().toISOString(),
    headline: state.headline,
    mode: state.mode,
    customExercises: state.customExercises,
    bodyweightEntries: state.bodyweightEntries,
    entries: state.entries
  };

  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload));
  const downloadAnchor = document.createElement("a");
  downloadAnchor.setAttribute("href", dataStr);
  
  const cleanHeadline = state.headline.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  downloadAnchor.setAttribute("download", `adrenaline-data-${cleanHeadline}-${new Date().toISOString().split("T")[0]}.json`);
  
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

function triggerImportFileInput() {
  triggerHaptic(5);
  const input = document.getElementById("importFileInput");
  if (input) input.click();
}

function importWorkoutData(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function(e) {
    try {
      const parsed = JSON.parse(e.target.result);
      
      let entriesToImport = [];
      let customExercisesToImport = {};
      let bodyweightEntriesToImport = [];
      let headlineToImport = state.headline;
      let modeToImport = state.mode;

      // Helper to parse if string, otherwise return as is
      const parseField = (val) => {
        if (typeof val === "string") {
          try {
            return JSON.parse(val);
          } catch (err) {
            return val;
          }
        }
        return val;
      };

      // Format 1: Raw localStorage export format
      if (parsed && (parsed["gym-tracker-inline"] || parsed[STORAGE_KEY])) {
        const rawEntries = parsed["gym-tracker-inline"] || parsed[STORAGE_KEY];
        entriesToImport = parseField(rawEntries) || [];
        
        const rawCustom = parsed["gym-tracker-custom-exercises"] || parsed[CUSTOM_EXER_KEY];
        customExercisesToImport = parseField(rawCustom) || {};
        
        const rawBodyweight = parsed["gym-tracker-bodyweight"] || parsed[BODYWEIGHT_KEY];
        bodyweightEntriesToImport = parseField(rawBodyweight) || [];
        
        const rawHeadline = parsed["gym-tracker-headline"] || parsed[HEADLINE_KEY];
        headlineToImport = parseField(rawHeadline) || state.headline;
        
        const rawMode = parsed["gym-tracker-mode"] || parsed[MODE_KEY];
        modeToImport = parseField(rawMode) || state.mode;
      }
      // Format 2: Old/new nested storage format or root-level payload format
      else if (parsed && typeof parsed === "object") {
        let dataSource = parsed;
        if (parsed.storage) {
          dataSource = parseField(parsed.storage);
        }

        if (Array.isArray(parsed)) {
          entriesToImport = parsed;
        } else if (dataSource && typeof dataSource === "object") {
          entriesToImport = parseField(dataSource.entries) || [];
          customExercisesToImport = parseField(dataSource.customExercises) || {};
          bodyweightEntriesToImport = parseField(dataSource.bodyweightEntries) || [];
          headlineToImport = parseField(dataSource.headline) || parseField(parsed.headline) || state.headline;
          modeToImport = parseField(dataSource.mode) || parseField(parsed.mode) || state.mode;
        }
      }

      // Ensure lists are arrays and objects are objects
      if (!Array.isArray(entriesToImport)) {
        entriesToImport = [];
      }
      if (typeof customExercisesToImport !== "object" || customExercisesToImport === null) {
        customExercisesToImport = {};
      }
      if (!Array.isArray(bodyweightEntriesToImport)) {
        bodyweightEntriesToImport = [];
      }

      if (entriesToImport.length === 0 && bodyweightEntriesToImport.length === 0 && Object.keys(customExercisesToImport).length === 0) {
        alert("No valid workout logs, custom exercises, or weight entries found in this backup file.");
        return;
      }

      if (confirm("Importing this backup package will overwrite your current settings, title, weights, and logs. Do you want to proceed?")) {
        triggerHaptic([30, 20, 30]);

        state.headline = headlineToImport;
        state.mode = modeToImport;
        
        // Merge custom exercises instead of replacing — preserve existing + add imported
        Object.keys(customExercisesToImport).forEach(muscle => {
          const existing = state.customExercises[muscle] || [];
          const imported = customExercisesToImport[muscle] || [];
          const merged = [...existing];
          imported.forEach(ex => {
            const alreadyExists = merged.some(m => normalizeName(m.name) === normalizeName(ex.name));
            if (!alreadyExists) merged.push(ex);
          });
          state.customExercises[muscle] = dedupeExerciseObjects(merged);
        });
        
        state.bodyweightEntries = bodyweightEntriesToImport;
        state.entries = entriesToImport;

        saveAllData();
        await loadAllData();
        initApp();
        
        alert("Backups imported successfully!");
        switchView("view-muscles");
      }
    } catch (err) {
      alert("Failed to parse JSON file correctly: " + err.message);
    }
  };
  reader.readAsText(file);
}

// App Orchestration Initialization
// ================================================
// Exercise Guides Database & Helper
// ================================================
const EXERCISE_GUIDES = {
  "Incline Press (Dumbbell)": {
    steps: [
      "Set incline bench to 30-45 degrees.",
      "Start with dumbbells at chest level, elbows at 45 degrees.",
      "Press dumbbells up in a controlled arc, squeezing the upper chest."
    ],
    visual: "Upper-Chest Press"
  },
  "Chest Fly Machine": {
    steps: [
      "Adjust seat so handles are at chest height.",
      "Keep elbows slightly bent, contract chest to bring hands together in a wide arc.",
      "Return to starting position slowly, feeling the stretch."
    ],
    visual: "Pectoral Fly"
  },
  "Push-ups": {
    steps: [
      "Start in a plank position with hands slightly wider than shoulders.",
      "Lower body until chest nearly touches the floor, keeping core rigid.",
      "Push back up to starting position, locking out at the top."
    ],
    visual: "Plank Pushup"
  },
  "Chest Bench Press": {
    steps: [
      "Lie flat on the bench, grip the barbell slightly wider than shoulders.",
      "Lower the barbell under control to mid-chest level.",
      "Press the bar up powerfully, locking out at the top."
    ],
    visual: "Flat Bench Barbell"
  },
  "Inclined Bench Press": {
    steps: [
      "Lie on incline bench, grip bar slightly wider than shoulders.",
      "Lower the barbell under control to upper chest level.",
      "Press bar straight up powerfully."
    ],
    visual: "Incline Barbell"
  },
  "Fly (Dumbbell)": {
    steps: [
      "Lie flat on bench, hold dumbbells directly above chest with palms facing.",
      "Lower weights out in wide arc until feeling stretch in chest.",
      "Engage chest to pull weights back to starting position."
    ],
    visual: "Dumbbell Fly"
  },
  "Tricep Pushdown": {
    steps: [
      "Stand facing the cable machine, elbows tucked firmly at your sides.",
      "Extend your arms fully to press the bar/rope down.",
      "Return slowly, keeping upper arms perfectly stationary."
    ],
    visual: "Cable Pushdown"
  },
  "Overhead Tricep Extension": {
    steps: [
      "Hold dumbbell/rope overhead, elbows tucked close to ears.",
      "Lower the weight behind your head by bending only at elbows.",
      "Extend arms to return to start."
    ],
    visual: "Overhead Dumbbell"
  },
  "Rope Pushdown": {
    steps: [
      "Stand facing machine, hold rope ends, elbows tucked.",
      "Push rope down, flaring hands apart at bottom extension.",
      "Slowly return under control."
    ],
    visual: "Cable Rope Pushdown"
  },
  "Dips": {
    steps: [
      "Support weight on parallel bars, elbows straight.",
      "Lower body by bending elbows until chest is close to hands.",
      "Press back up to lock out."
    ],
    visual: "Parallel Bar Dips"
  },
  "Lat Pulldown": {
    steps: [
      "Grip the bar wider than shoulder-width, sit secure under pads.",
      "Pull the bar down to your upper chest, leading with elbows.",
      "Control the weight back up to the starting position."
    ],
    visual: "Pullover Pulldown"
  },
  "Seated Row": {
    steps: [
      "Sit at machine, feet on plates, knees slightly bent.",
      "Pull handle toward lower chest, squeezing shoulder blades.",
      "Extend arms back with controlled speed."
    ],
    visual: "Cable Row"
  },
  "Deadlift": {
    steps: [
      "Stand with mid-foot under barbell, hip-width stance.",
      "Hinge at hips, grip the bar, keep flat back.",
      "Drive through heels to stand upright, locking hips at top."
    ],
    visual: "Hip Hinge Lift"
  },
  "Pull-ups": {
    steps: [
      "Hang from bar with palms facing away, shoulder-width.",
      "Pull chest to bar by driving elbows down.",
      "Lower slowly to full hang."
    ],
    visual: "Vertical Pull"
  },
  "Curl (Barbell)": {
    steps: [
      "Stand upright, grip barbell with underhand grip.",
      "Curl bar up toward shoulders, keeping elbows locked at sides.",
      "Lower barbell slowly under complete control."
    ],
    visual: "Barbell Curl"
  },
  "Hammer Curl (Dumbbell)": {
    steps: [
      "Stand with dumbbells at sides, palms facing each other.",
      "Curl weights up while keeping palms facing in.",
      "Control the eccentric phase back down."
    ],
    visual: "Neutral Grip Curl"
  },
  "Back Squat": {
    steps: [
      "Rest barbell on upper traps, grip firmly.",
      "Hinge hips back and bend knees, squatting to parallel or deeper.",
      "Drive straight up, keeping spine neutral and knees tracking toes."
    ],
    visual: "Squat Dynamics"
  }
};

function getExerciseGuide(name, muscle) {
  const normalized = normalizeName(name);
  const matchedKey = Object.keys(EXERCISE_GUIDES).find(k => normalized.includes(normalizeName(k)));
  if (matchedKey) return EXERCISE_GUIDES[matchedKey];

  return {
    steps: [
      `Secure body alignment for ${name}.`,
      `Contract targeted ${muscle} groups in a controlled range of motion.`,
      `Ensure maximum stability and smooth breathing throughout the lift.`
    ],
    visual: "Core Kinetics"
  };
}

// Exercise Manager View
function initExerciseManager() {
  renderExerciseManagerList();
  switchView("view-exercise-manager");
}

function renderExerciseManagerList(filterText = "") {
  const container = document.getElementById("exManagerList");
  if (!container) return;
  container.innerHTML = "";

  const filter = (filterText || "").toLowerCase().trim();

  MUSCLES.forEach(muscle => {
    const allExercises = getAllExercisesForMuscle(muscle);
    
    // Filter exercises
    const filtered = filter 
      ? allExercises.filter(ex => ex.name.toLowerCase().includes(filter) || muscle.toLowerCase().includes(filter))
      : allExercises;

    if (filtered.length === 0) return;

    const group = document.createElement("div");
    group.className = "ex-manager-group";

    const title = document.createElement("div");
    title.className = "ex-manager-group-title";
    title.style.display = "flex";
    title.style.justifyContent = "space-between";
    title.style.alignItems = "center";
    title.innerHTML = `
      <span>${muscle} <span class="ex-count">${filtered.length} exercises</span></span>
      <button class="btn btn-cyan btn-sm" style="padding: 2px 8px; min-height: 24px; font-size: 0.72rem; border-radius: var(--radius-sm);">➕ Add</button>
    `;
    group.appendChild(title);

    // Add click handler for the muscle group "Add Custom Exercise" button
    const addBtn = title.querySelector("button");
    addBtn.addEventListener("click", () => {
      triggerHaptic(10);
      const name = prompt(`Enter new custom exercise name for ${muscle}:`);
      if (!name || !name.trim()) return;
      
      const type = prompt(`Enter type (weighted, bodyweight, or cardio):`, "weighted");
      if (!type) return;
      const normalizedType = type.trim().toLowerCase();
      if (!["weighted", "bodyweight", "cardio"].includes(normalizedType)) {
        alert("Invalid type! Must be weighted, bodyweight, or cardio.");
        return;
      }
      
      const exercises = getAllExercisesForMuscle(muscle);
      const match = exercises.find(ex => normalizeName(ex.name) === normalizeName(name));
      if (match) {
        alert(`The exercise "${name}" already exists on this battlefield.`);
        return;
      }
      
      if (!state.customExercises[muscle]) {
        state.customExercises[muscle] = [];
      }
      state.customExercises[muscle].push({
        name: name.trim(),
        type: normalizedType
      });
      saveAllData();
      renderExerciseManagerList(filterText);
    });

    filtered.forEach(ex => {
      const isDefault = false;
      const item = document.createElement("div");
      item.className = "ex-manager-item";
      item.style.flexDirection = "column";
      item.style.alignItems = "stretch";

      const mainRow = document.createElement("div");
      mainRow.className = "ex-manager-main-row";
      mainRow.style.display = "flex";
      mainRow.style.alignItems = "center";
      mainRow.style.gap = "8px";
      mainRow.style.width = "100%";

      // Info/How-To toggle button
      const infoBtn = document.createElement("button");
      infoBtn.className = "btn btn-secondary btn-sm";
      infoBtn.innerHTML = "ℹ️";
      infoBtn.title = "View Execution Guide";
      infoBtn.style.padding = "3px 6px";
      infoBtn.style.minHeight = "26px";
      infoBtn.style.minWidth = "26px";
      mainRow.appendChild(infoBtn);

      // Exercise name
      const nameDiv = document.createElement("div");
      nameDiv.className = "ex-name";
      nameDiv.textContent = ex.name;
      nameDiv.style.cursor = "pointer";
      mainRow.appendChild(nameDiv);

      // Type badge
      const typeBadge = document.createElement("span");
      typeBadge.className = `ex-type-badge ${ex.type}`;
      typeBadge.textContent = ex.type;
      mainRow.appendChild(typeBadge);

      // Action buttons
      const actionsDiv = document.createElement("div");
      actionsDiv.className = "ex-actions";

      // Edit (rename) button
      const editBtn = document.createElement("button");
      editBtn.className = "btn btn-secondary btn-sm";
      editBtn.innerHTML = "✏️";
      editBtn.title = isDefault ? "Cannot rename default exercises" : "Rename exercise";
      if (isDefault) {
        editBtn.style.opacity = "0.3";
        editBtn.style.pointerEvents = "none";
      }
      editBtn.addEventListener("click", (e) => {
        e.stopPropagation(); // Avoid triggering info toggle
        // Inline edit mode
        nameDiv.innerHTML = "";
        const input = document.createElement("input");
        input.type = "text";
        input.value = ex.name;
        input.style.marginBottom = "0";
        input.style.fontSize = "0.82rem";
        input.style.padding = "4px 8px";
        input.style.minHeight = "28px";
        nameDiv.appendChild(input);
        input.focus();
        input.select();

        const saveRename = () => {
          const newName = input.value.trim();
          if (newName && newName !== ex.name) {
            // Update in custom exercises
            const customs = state.customExercises[muscle] || [];
            const target = customs.find(c => normalizeName(c.name) === normalizeName(ex.name));
            if (target) {
              // Also update any history entries referencing the old name
              state.entries.forEach(entry => {
                if (entry.muscle === muscle && normalizeName(entry.exercise) === normalizeName(ex.name)) {
                  entry.exercise = newName;
                }
              });
              target.name = newName;
              saveAllData();
            }
          }
          renderExerciseManagerList(filterText);
        };

        input.addEventListener("blur", saveRename);
        input.addEventListener("keydown", (evt) => {
          if (evt.key === "Enter") saveRename();
          if (evt.key === "Escape") renderExerciseManagerList(filterText);
        });
      });
      actionsDiv.appendChild(editBtn);

      // Delete button
      const delBtn = document.createElement("button");
      delBtn.className = "btn btn-danger btn-sm";
      delBtn.innerHTML = "🗑";
      
      const hasHistory = state.entries.some(entry => 
        entry.muscle === muscle && 
        normalizeName(entry.exercise) === normalizeName(ex.name)
      );

      if (hasHistory) {
        delBtn.style.opacity = "0.35";
        delBtn.title = "Delete exercise (Warning: has active history logs)";
      } else {
        delBtn.title = "Delete exercise";
      }

      delBtn.addEventListener("click", (e) => {
        e.stopPropagation(); // Avoid triggering info toggle
        if (isDefault) return;
        
        const hasHistory = state.entries.some(entry => 
          entry.muscle === muscle && 
          normalizeName(entry.exercise) === normalizeName(ex.name)
        );
        
        let msg = `Delete "${ex.name}" from ${muscle}?`;
        if (hasHistory) {
          msg = `⚠️ WARNING: You have active workout logs in your history for "${ex.name}"!\n\nDeleting it from the library will remove it from the selector, but your past logs will still remain. Do you want to proceed?`;
        }
        
        if (!confirm(msg)) return;
        
        triggerHaptic(10);
        const customs = state.customExercises[muscle] || [];
        state.customExercises[muscle] = customs.filter(c => normalizeName(c.name) !== normalizeName(ex.name));
        saveAllData();
        renderExerciseManagerList(filterText);
      });
      actionsDiv.appendChild(delBtn);

      mainRow.appendChild(actionsDiv);
      item.appendChild(mainRow);

      // How-To Panel
      const howToPanel = document.createElement("div");
      howToPanel.className = "ex-howto-panel";
      
      const guide = getExerciseGuide(ex.name, muscle);
      
      const stepsList = document.createElement("ol");
      stepsList.className = "ex-howto-steps";
      stepsList.style.paddingLeft = "16px";
      guide.steps.forEach(step => {
        const li = document.createElement("li");
        li.textContent = step;
        stepsList.appendChild(li);
      });
      howToPanel.appendChild(stepsList);

      const visualDiv = document.createElement("div");
      const normExName = normalizeName(ex.name);
      if (normExName === "chest bench press") {
        visualDiv.className = "bench-press-anim-container";
        visualDiv.innerHTML = `
          <!-- Left Column: Front Kinetics -->
          <div class="kinetics-view front-view">
            <div class="dynamics-label">Front Kinetics</div>
            <div class="bench-press-bench-legs"></div>
            <div class="bench-press-bench"></div>
            <div class="bench-press-torso"></div>
            <div class="bench-press-barbell">
              <div class="barbell-shaft"></div>
              <div class="barbell-weight weight-left-inner"></div>
              <div class="barbell-weight weight-left"></div>
              <div class="barbell-weight weight-right-inner"></div>
              <div class="barbell-weight weight-right"></div>
            </div>
          </div>

          <!-- Right Column: Side Biomechanics -->
          <div class="kinetics-view side-view-panel">
            <div class="dynamics-label">Side Biomechanics</div>
            <div class="side-bench-legs"></div>
            <div class="side-bench"></div>
            <div class="side-lifter-head"></div>
            <div class="side-lifter-torso"></div>
            <div class="side-lifter-hips"></div>
            <div class="side-lifter-leg"></div>
            <!-- Dotted trajectory trace SVG -->
            <svg class="side-trajectory-svg" viewBox="0 0 100 80">
              <path d="M 46 32 Q 54 44 56 58" fill="none" stroke="rgba(0, 246, 237, 0.15)" stroke-width="1.5" stroke-dasharray="2 2" />
            </svg>
            <div class="side-barbell">
              <div class="side-barbell-bar"></div>
              <div class="side-barbell-plate"></div>
              <div class="side-barbell-collar"></div>
            </div>
          </div>

          <!-- Shared Phase overlay in absolute bottom left -->
          <div class="dynamics-phase"></div>
        `;
      } else if (normExName === "inclined bench press") {
        visualDiv.className = "bench-press-anim-container incline-mode";
        visualDiv.innerHTML = `
          <!-- Left Column: Front Kinetics -->
          <div class="kinetics-view front-view">
            <div class="dynamics-label">Front Kinetics</div>
            <div class="incline-bench-legs-front"></div>
            <div class="incline-bench-front"></div>
            <div class="incline-torso-front"></div>
            <div class="incline-barbell-front">
              <div class="barbell-shaft"></div>
              <div class="barbell-weight weight-left-inner"></div>
              <div class="barbell-weight weight-left"></div>
              <div class="barbell-weight weight-right-inner"></div>
              <div class="barbell-weight weight-right"></div>
            </div>
          </div>

          <!-- Right Column: Side Biomechanics -->
          <div class="kinetics-view side-view-panel">
            <div class="dynamics-label">Side Biomechanics</div>
            <div class="incline-bench-legs-side"></div>
            <div class="incline-bench-side"></div>
            <div class="incline-lifter-head"></div>
            <div class="incline-lifter-torso"></div>
            <div class="incline-lifter-hips"></div>
            <div class="incline-lifter-leg"></div>
            <!-- Dotted trajectory trace SVG -->
            <svg class="side-trajectory-svg" viewBox="0 0 100 80">
              <path d="M 40 30 Q 52 42 58 52" fill="none" stroke="rgba(0, 246, 237, 0.15)" stroke-width="1.5" stroke-dasharray="2 2" />
            </svg>
            <div class="incline-barbell-side">
              <div class="side-barbell-bar"></div>
              <div class="side-barbell-plate"></div>
              <div class="side-barbell-collar"></div>
            </div>
          </div>

          <!-- Shared Phase overlay in absolute bottom left -->
          <div class="dynamics-phase"></div>
        `;
      } else if (normExName === "back squat") {
        visualDiv.className = "bench-press-anim-container squat-mode";
        visualDiv.innerHTML = `
          <!-- Left Column: Front Kinetics -->
          <div class="kinetics-view front-view">
            <div class="dynamics-label">Front Kinetics</div>
            <div class="squat-rack-legs-front"></div>
            <div class="squat-lifter-torso-front"></div>
            <div class="squat-lifter-thighs-front"></div>
            <div class="squat-barbell-front">
              <div class="barbell-shaft"></div>
              <div class="barbell-weight weight-left-inner"></div>
              <div class="barbell-weight weight-left"></div>
              <div class="barbell-weight weight-right-inner"></div>
              <div class="barbell-weight weight-right"></div>
            </div>
          </div>

          <!-- Right Column: Side Biomechanics -->
          <div class="kinetics-view side-view-panel">
            <div class="dynamics-label">Side Biomechanics</div>
            <div class="squat-rack-legs-side"></div>
            <div class="squat-lifter-head-side"></div>
            <div class="squat-lifter-torso-side"></div>
            <div class="squat-lifter-thigh-side"></div>
            <div class="squat-lifter-calf-side"></div>
            <!-- Dotted trajectory trace SVG -->
            <svg class="side-trajectory-svg" viewBox="0 0 100 80">
              <path d="M 50 16 L 50 56" fill="none" stroke="rgba(0, 246, 237, 0.15)" stroke-width="1.5" stroke-dasharray="2 2" />
            </svg>
            <div class="squat-barbell-side">
              <div class="side-barbell-bar"></div>
              <div class="side-barbell-plate"></div>
              <div class="side-barbell-collar"></div>
            </div>
          </div>

          <!-- Shared Phase overlay in absolute bottom left -->
          <div class="dynamics-phase"></div>
        `;
      } else if (normExName === "deadlift") {
        visualDiv.className = "bench-press-anim-container deadlift-mode";
        visualDiv.innerHTML = `
          <!-- Left Column: Front Kinetics -->
          <div class="kinetics-view front-view">
            <div class="dynamics-label">Front Kinetics</div>
            <div class="deadlift-platform-front"></div>
            <div class="deadlift-lifter-torso-front"></div>
            <div class="deadlift-lifter-arms-front"></div>
            <div class="deadlift-barbell-front">
              <div class="barbell-shaft"></div>
              <div class="barbell-weight weight-left-inner"></div>
              <div class="barbell-weight weight-left"></div>
              <div class="barbell-weight weight-right-inner"></div>
              <div class="barbell-weight weight-right"></div>
            </div>
          </div>

          <!-- Right Column: Side Biomechanics -->
          <div class="kinetics-view side-view-panel">
            <div class="dynamics-label">Side Biomechanics</div>
            <div class="deadlift-platform-side"></div>
            <div class="deadlift-lifter-hips-side"></div>
            <div class="deadlift-lifter-torso-side"></div>
            <div class="deadlift-lifter-thigh-side"></div>
            <div class="deadlift-lifter-calf-side"></div>
            <div class="deadlift-lifter-arm-side"></div>
            <!-- Dotted trajectory trace SVG -->
            <svg class="side-trajectory-svg" viewBox="0 0 100 80">
              <path d="M 50 56 L 50 25" fill="none" stroke="rgba(0, 246, 237, 0.15)" stroke-width="1.5" stroke-dasharray="2 2" />
            </svg>
            <div class="deadlift-barbell-side">
              <div class="side-barbell-bar"></div>
              <div class="side-barbell-plate"></div>
              <div class="side-barbell-collar"></div>
            </div>
          </div>

          <!-- Shared Phase overlay in absolute bottom left -->
          <div class="dynamics-phase"></div>
        `;
      } else {
        visualDiv.style.display = "none";
      }
      
      if (visualDiv.style.display !== "none") {
        howToPanel.appendChild(visualDiv);
      }

      item.appendChild(howToPanel);

      // Toggle behavior
      const toggleHowTo = () => {
        triggerHaptic(5);
        howToPanel.classList.toggle("active");
      };
      infoBtn.addEventListener("click", toggleHowTo);
      nameDiv.addEventListener("click", toggleHowTo);

      group.appendChild(item);
    });

    container.appendChild(group);
  });
}

function initApp() {
  renderMuscleTabs();
  
  // Set default mode in selector
  const modeSelect = document.getElementById("modeSelect");
  if (modeSelect) modeSelect.value = state.mode;

  // Bind change handlers
  if (modeSelect) {
    modeSelect.addEventListener("change", (e) => {
      triggerHaptic(5);
      state.mode = e.target.value;
      saveAllData();
      
      // If we are currently logging, recalculate target pre-fills
      if (state.selectedMuscle && state.selectedExercise) {
        const currentMeta = getAllExercisesForMuscle(state.selectedMuscle).find(ex => 
          normalizeName(ex.name) === normalizeName(state.selectedExercise)
        );
        if (currentMeta) {
          buildSuggestedSets(currentMeta.type);
        }
      }
    });
  }

  // Handle headline title editing triggers
  const btnToggleEdit = document.getElementById("btnToggleHeadlineEdit");
  if (btnToggleEdit) btnToggleEdit.addEventListener("click", toggleFocusMode); // Reuse Focus logic if required or default
}

function initIosInstallBanner() {
  const userAgent = (window.navigator.userAgent || "").toLowerCase();
  const isIos = /iphone|ipad|ipod/.test(userAgent);
  const isStandalone = window.navigator.standalone === true;

  if (isIos && !isStandalone) {
    const isDismissed = sessionStorage.getItem("ios-install-banner-dismissed");
    if (!isDismissed) {
      const banner = document.getElementById("iosInstallBanner");
      if (banner) {
        banner.style.display = "block";
        setTimeout(() => {
          banner.style.opacity = "1";
          banner.style.transform = "translateY(0)";
        }, 100);
      }
    }
  }
}

// DOM Setup Binder
document.addEventListener("DOMContentLoaded", async () => {
  // Load data & set up tabs
  await loadAllData();
  initApp();
  initIosInstallBanner();

  // Automatically open native calendar picker when tapping anywhere on the date input
  document.querySelectorAll('input[type="date"]').forEach(input => {
    const showCalendar = () => {
      if (typeof input.showPicker === "function") {
        try {
          input.showPicker();
        } catch (e) {
          console.log("showPicker failed:", e);
        }
      }
    };
    input.addEventListener("click", showCalendar);
    input.addEventListener("focus", showCalendar);
  });

  // Settings Modal open/close binders
  document.getElementById("btnOpenSettings")?.addEventListener("click", (e) => {
    triggerHaptic(10);
    
    const btn = e.currentTarget;
    btn.classList.add("sparkle-active");
    setTimeout(() => {
      btn.classList.remove("sparkle-active");
    }, 600);
    
    const rect = btn.getBoundingClientRect();
    const x = rect.left + rect.width / 2 + window.scrollX;
    const y = rect.top + rect.height / 2 + window.scrollY;
    triggerSparklingAnimation(x, y);

    const settingsModal = document.getElementById("settingsModal");
    if (settingsModal) {
      settingsModal.style.display = "flex";
      settingsModal.offsetHeight; // force reflow
      settingsModal.classList.add("active");
      const headlineInput = document.getElementById("headlineInput");
      if (headlineInput) headlineInput.value = state.headline;
      
      const chk = document.getElementById("chkSynthwave");
      if (chk) chk.checked = state.synthPlaying;
    }
  });

  document.getElementById("btnCloseSettings")?.addEventListener("click", () => {
    triggerHaptic(5);
    const settingsModal = document.getElementById("settingsModal");
    if (settingsModal) {
      settingsModal.classList.remove("active");
      setTimeout(() => {
        settingsModal.style.display = "none";
      }, 300);
    }
  });

  // Theme select skin swap binder
  document.getElementById("themeSelect")?.addEventListener("change", (e) => {
    triggerHaptic(5);
    state.theme = e.target.value;
    document.documentElement.setAttribute("data-theme", state.theme);
    localStorage.setItem("gym-tracker-theme", state.theme);
  });

  // Global Weight Unit Select binder
  document.getElementById("unitSelect")?.addEventListener("change", (e) => {
    triggerHaptic(5);
    state.unit = e.target.value;
    saveAllData();
    updateUnitUI();
  });

  // Synthbeats procedural sequencer beats binder
  document.getElementById("btnToggleSynthwave")?.addEventListener("click", () => {
    triggerHaptic(10);
    if (state.synthPlaying) {
      stopSynthwaveBeats();
    } else {
      startSynthwaveBeats();
    }
  });

  document.getElementById("chkSynthwave")?.addEventListener("change", (e) => {
    triggerHaptic(10);
    if (e.target.checked) {
      startSynthwaveBeats();
    } else {
      stopSynthwaveBeats();
    }
  });

  // iOS Install Banner close binder
  document.getElementById("btnCloseInstallBanner")?.addEventListener("click", () => {
    triggerHaptic(5);
    const banner = document.getElementById("iosInstallBanner");
    if (banner) {
      banner.style.opacity = "0";
      banner.style.transform = "translateY(20px)";
      setTimeout(() => {
        banner.style.display = "none";
      }, 300);
    }
    sessionStorage.setItem("ios-install-banner-dismissed", "true");
  });

  // Navigation binders
  document.getElementById("btnBackToMuscles")?.addEventListener("click", () => {
    switchView("view-muscles");
  });

  document.getElementById("btnSkipToLogging")?.addEventListener("click", () => {
    initWorkoutLoggingView();
  });

  document.getElementById("btnBackToOverview")?.addEventListener("click", () => {
    initRecapView();
  });

  // Action Binders
  document.getElementById("btnWorkoutComplete")?.addEventListener("click", completeWorkout);
  document.getElementById("btnSaveWorkout")?.addEventListener("click", saveWorkoutEntry);
  document.getElementById("btnAddSet")?.addEventListener("click", addSet);
  document.getElementById("btnCopyLastSets")?.addEventListener("click", copyLastWorkoutSets);
  document.getElementById("btnFocusMode")?.addEventListener("click", toggleFocusMode);

  // Custom Exercises
  document.getElementById("btnAddExercise")?.addEventListener("click", showAddExerciseUI);
  document.getElementById("btnConfirmAddExercise")?.addEventListener("click", confirmAddExercise);
  document.getElementById("btnDeleteExercise")?.addEventListener("click", deleteCustomExercise);
  document.getElementById("exerciseSelect")?.addEventListener("change", handleExerciseChange);
  
  // Rename selected exercise toggle button
  document.getElementById("btnRenameExercise")?.addEventListener("click", () => {
    triggerHaptic(5);
    const exerciseSelect = document.getElementById("exerciseSelect");
    const editExInput = document.getElementById("editExerciseInput");
    const btnRename = document.getElementById("btnRenameExercise");
    
    if (exerciseSelect && editExInput && btnRename) {
      exerciseSelect.style.display = "none";
      editExInput.style.display = "block";
      editExInput.value = exerciseSelect.value;
      editExInput.focus();
      editExInput.select();
      btnRename.style.display = "none";
    }
  });
  document.getElementById("exerciseTypeSelect")?.addEventListener("change", (e) => {
    triggerHaptic(5);
    const newType = e.target.value;
    if (state.selectedMuscle && state.selectedExercise) {
      const customs = state.customExercises[state.selectedMuscle] || [];
      const target = customs.find(ex => normalizeName(ex.name) === normalizeName(state.selectedExercise));
      if (target) {
        target.type = newType;
        saveAllData();
      }
    }
    updateLoggingInterface(newType);
  });

  // Date-wise History View
  document.getElementById("btnDatewiseHistory")?.addEventListener("click", initDateHistoryView);
  document.getElementById("btnBackFromDateHistory")?.addEventListener("click", () => {
    switchView("view-muscles");
  });
  document.getElementById("dateHistoryInput")?.addEventListener("change", renderDatewiseHistory);

  // Bodyweight View
  document.getElementById("btnBodyweight")?.addEventListener("click", initBodyweightView);
  document.getElementById("btnBackFromBodyweight")?.addEventListener("click", () => {
    switchView("view-muscles");
  });
  document.getElementById("btnSaveBodyweight")?.addEventListener("click", saveBodyweightLog);

  // Exercise Manager View Binders
  document.getElementById("btnOpenExManager")?.addEventListener("click", () => {
    triggerHaptic(10);
    const settingsModal = document.getElementById("settingsModal");
    if (settingsModal) {
      settingsModal.style.opacity = "0";
      setTimeout(() => {
        settingsModal.style.display = "none";
      }, 300);
    }
    initExerciseManager();
  });
  document.getElementById("btnBackFromExManager")?.addEventListener("click", () => {
    switchView("view-muscles");
  });
  document.getElementById("exManagerSearch")?.addEventListener("input", (e) => {
    renderExerciseManagerList(e.target.value);
  });

  // Danger Reset Binders
  document.getElementById("btnGoToReset")?.addEventListener("click", () => {
    const settingsModal = document.getElementById("settingsModal");
    if (settingsModal) {
      settingsModal.style.display = "none";
      settingsModal.style.opacity = "0";
    }
    switchView("view-reset");
  });
  document.getElementById("btnCancelReset")?.addEventListener("click", () => {
    switchView("view-muscles");
  });
  document.getElementById("btnConfirmReset")?.addEventListener("click", confirmResetAllData);

  // Backups Import / Export Binders
  document.getElementById("btnExportData")?.addEventListener("click", exportWorkoutData);
  document.getElementById("btnImportData")?.addEventListener("click", triggerImportFileInput);
  document.getElementById("importFileInput")?.addEventListener("change", (e) => {
    const settingsModal = document.getElementById("settingsModal");
    if (settingsModal) {
      settingsModal.style.display = "none";
      settingsModal.style.opacity = "0";
    }
    importWorkoutData(e);
  });

  // Title edit triggers in Settings modal
  document.getElementById("btnSaveHeadline")?.addEventListener("click", () => {
    saveHeadlineTitle();
    const settingsModal = document.getElementById("settingsModal");
    if (settingsModal) {
      settingsModal.style.opacity = "0";
      setTimeout(() => {
        settingsModal.style.display = "none";
      }, 300);
    }
  });

  // Force Update / Reload cache binder
  document.getElementById("btnForceReload")?.addEventListener("click", () => {
    if (confirm("Force updating will clear the PWA cache and reload to fetch the latest cyberpunk upgrades directly from the network. Proceed?")) {
      triggerHaptic([30, 30, 30]);
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
          for (let registration of registrations) {
            registration.unregister();
          }
        });
      }
      if ("caches" in window) {
        caches.keys().then(names => {
          for (let name of names) {
            caches.delete(name);
          }
        });
      }
      setTimeout(() => {
        window.location.reload(true);
      }, 500);
    }
  });

  // Conquest Achievements click binders to show goals
  document.getElementById("badgeStreak")?.addEventListener("click", () => showAchievementTarget("streak"));
  document.getElementById("badgeTon")?.addEventListener("click", () => showAchievementTarget("ton"));
  document.getElementById("badgeLung")?.addEventListener("click", () => showAchievementTarget("lung"));
  document.getElementById("badgeWeigh")?.addEventListener("click", () => showAchievementTarget("weigh"));
});

// PWA Service Worker Registration
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js")
      .then(reg => console.log("Service Worker successfully registered with scope:", reg.scope))
      .catch(err => console.log("Service Worker registration failed:", err));
  });
}

// ==========================================================================
// PREMIUM CYBERPUNK ACTION PACK HELPERS
// ==========================================================================

// 1. Achievements & Streak Calculator
// 1. Achievements & Streak Calculator
function getStreakCount() {
  const activeDates = Array.from(new Set(
    state.entries
      .filter(e => e.exercise !== "__muscle_complete__")
      .map(e => e.date)
  )).sort((a, b) => new Date(b) - new Date(a)); // Newest first
  
  let currentStreak = 0;
  if (activeDates.length > 0) {
    const todayStr = new Date().toISOString().split("T")[0];
    const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    const today = new Date(todayStr + 'T00:00:00');
    const isMonday = today.getDay() === 1;
    const twoDaysAgoStr = new Date(today.getTime() - 2 * 86400000).toISOString().split('T')[0];

    // Streak continues only if there was a workout logged today, yesterday,
    // or on Saturday when today is Monday (Sunday rest day in between)
    const startOk = activeDates[0] === todayStr ||
                    activeDates[0] === yesterdayStr ||
                    (isMonday && activeDates[0] === twoDaysAgoStr);
    if (startOk) {
      currentStreak = 1;
      for (let i = 0; i < activeDates.length - 1; i++) {
        const d1 = new Date(activeDates[i] + 'T00:00:00');
        const d2 = new Date(activeDates[i+1] + 'T00:00:00');
        const diffTime = d1 - d2;
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

        // Count how many Sundays fall between d2 and d1 (exclusive of d1)
        let sundaysInGap = 0;
        for (let s = 1; s < diffDays; s++) {
          const mid = new Date(d2.getTime() + s * 86400000);
          if (mid.getDay() === 0) sundaysInGap++; // 0 = Sunday
        }

        const effectiveDiff = diffDays - sundaysInGap;
        if (effectiveDiff === 1) {
          currentStreak++;
        } else if (effectiveDiff > 1) {
          break; // Streak sequence broken (even after skipping Sundays)
        }
      }
    }
  }
  return currentStreak;
}

function getLifetimeVolume() {
  let totalVolume = 0;
  state.entries.forEach(e => {
    if (e.type === "weighted") {
      totalVolume += Number(e.totalVolume || 0);
    }
  });
  return totalVolume;
}

function getLifetimeDistance() {
  let totalDistance = 0;
  state.entries.forEach(e => {
    if (e.type === "cardio") {
      totalDistance += Number(e.totalDistance || 0);
    }
  });
  return totalDistance;
}

function showAchievementTarget(id) {
  triggerHaptic(10);
  let title = "";
  let icon = "";
  let currentVal = 0;
  let unit = "";
  let levels = [];
  
  if (id === "streak") {
    title = "Conquest Streak";
    icon = "⚡";
    currentVal = getStreakCount();
    unit = "days";
    levels = [
      { lvl: 1, target: 3, name: "Bronze Raider" },
      { lvl: 2, target: 7, name: "Silver Gladiator" },
      { lvl: 3, target: 15, name: "Gold Conquest Overlord" }
    ];
  } else if (id === "ton") {
    title = "Ton-Club";
    icon = "🏋️";
    currentVal = Math.round(getLifetimeVolume());
    unit = "kg";
    levels = [
      { lvl: 1, target: 1000, name: "Iron Recruit" },
      { lvl: 2, target: 5000, name: "Titan Crusher" },
      { lvl: 3, target: 15000, name: "All-Out Legend" }
    ];
  } else if (id === "lung") {
    title = "Iron-Lung";
    icon = "🏃";
    currentVal = Math.round(getLifetimeDistance() * 10) / 10;
    unit = "km";
    levels = [
      { lvl: 1, target: 5.0, name: "Wind Runner" },
      { lvl: 2, target: 20.0, name: "Stamina Cyborg" },
      { lvl: 3, target: 50.0, name: "Hyper-Drive Racer" }
    ];
  } else if (id === "weigh") {
    title = "Scale-Master";
    icon = "⚖️";
    currentVal = state.bodyweightEntries.length;
    unit = "logs";
    levels = [
      { lvl: 1, target: 3, name: "Habit Builder" },
      { lvl: 2, target: 10, name: "Stat Track Master" },
      { lvl: 3, target: 30, name: "Data Titan" }
    ];
  }

  let currentLvl = 0;
  levels.forEach(l => {
    if (currentVal >= l.target) {
      currentLvl = l.lvl;
    }
  });

  const nextLvl = levels.find(l => l.lvl === currentLvl + 1) || null;

  let message = "";
  if (currentLvl === 0) {
    message = `Locked!\nPush to reach ${levels[0].target} ${unit} to unlock Level 1 (${levels[0].name}).`;
  } else if (nextLvl) {
    message = `Current: Level ${currentLvl} (${levels[currentLvl-1].name}).\nNext Goal: Reach ${nextLvl.target} ${unit} to unlock Level ${nextLvl.lvl} (${nextLvl.name})!`;
  } else {
    message = `Max Level Conquered! Level ${currentLvl} (${levels[2].name}) - Absolute Overlord!`;
  }

  alert(`🏆 ACHIEVEMENT STATUS: ${icon} ${title}\n\nYour Current Record: ${currentVal} ${unit}\n\n${message}`);
}

function updateAchievements() {
  const streakEl = document.getElementById("badgeStreak");
  const tonEl = document.getElementById("badgeTon");
  const lungEl = document.getElementById("badgeLung");
  const weighEl = document.getElementById("badgeWeigh");
  const rankEl = document.getElementById("conquestRank");
  
  if (!streakEl || !tonEl || !lungEl || !weighEl || !rankEl) return;
  
  const currentStreak = getStreakCount();
  const totalVolume = getLifetimeVolume();
  const totalDistance = getLifetimeDistance();
  const weighInCount = state.bodyweightEntries.length;
  
  // Levels thresholds math
  let streakLvl = 0;
  if (currentStreak >= 15) streakLvl = 3;
  else if (currentStreak >= 7) streakLvl = 2;
  else if (currentStreak >= 3) streakLvl = 1;

  let tonLvl = 0;
  if (totalVolume >= 15000) tonLvl = 3;
  else if (totalVolume >= 5000) tonLvl = 2;
  else if (totalVolume >= 1000) tonLvl = 1;

  let lungLvl = 0;
  if (totalDistance >= 50.0) lungLvl = 3;
  else if (totalDistance >= 20.0) lungLvl = 2;
  else if (totalDistance >= 5.0) lungLvl = 1;

  let weighLvl = 0;
  if (weighInCount >= 30) weighLvl = 3;
  else if (weighInCount >= 10) weighLvl = 2;
  else if (weighInCount >= 3) weighLvl = 1;

  // Visual active glow targets unlocking
  if (streakLvl > 0) streakEl.classList.add("badge-active");
  else streakEl.classList.remove("badge-active");
  
  if (tonLvl > 0) tonEl.classList.add("badge-active");
  else tonEl.classList.remove("badge-active");
  
  if (lungLvl > 0) lungEl.classList.add("badge-active");
  else lungEl.classList.remove("badge-active");
  
  if (weighLvl > 0) weighEl.classList.add("badge-active");
  else weighEl.classList.remove("badge-active");
  
  // Set Level indicator label HTML
  const streakLabel = streakEl.querySelector(".stat-label");
  if (streakLabel) {
    streakLabel.innerHTML = streakLvl > 0 
      ? `Streak <span style="color:var(--accent);font-weight:800;">LVL ${streakLvl}</span>` 
      : "Conquest Streak";
  }

  const tonLabel = tonEl.querySelector(".stat-label");
  if (tonLabel) {
    tonLabel.innerHTML = tonLvl > 0 
      ? `Ton-Club <span style="color:var(--accent);font-weight:800;">LVL ${tonLvl}</span>` 
      : "Ton-Club";
  }

  const lungLabel = lungEl.querySelector(".stat-label");
  if (lungLabel) {
    lungLabel.innerHTML = lungLvl > 0 
      ? `Iron-Lung <span style="color:var(--accent);font-weight:800;">LVL ${lungLvl}</span>` 
      : "Iron-Lung";
  }

  const weighLabel = weighEl.querySelector(".stat-label");
  if (weighLabel) {
    weighLabel.innerHTML = weighLvl > 0 
      ? `Scale <span style="color:var(--accent);font-weight:800;">LVL ${weighLvl}</span>` 
      : "Scale-Master";
  }

  // Conquest rank overview based on level sum
  const totalLvlSum = streakLvl + tonLvl + lungLvl + weighLvl;
  const ranks = ["Rookie", "Gladiator", "Slayer", "Titan", "Overlord"];
  
  let rankIdx = 0;
  if (totalLvlSum >= 10) rankIdx = 4;
  else if (totalLvlSum >= 6) rankIdx = 3;
  else if (totalLvlSum >= 3) rankIdx = 2;
  else if (totalLvlSum >= 1) rankIdx = 1;
  
  rankEl.textContent = ranks[rankIdx];
  
  // descriptive tooltips fallback
  streakEl.title = `Current Streak: ${currentStreak} days (Tap for targets)`;
  tonEl.title = `Lifetime Volume: ${Math.round(totalVolume)} kg (Tap for targets)`;
  lungEl.title = `Lifetime Cardio: ${Math.round(totalDistance * 10) / 10} km (Tap for targets)`;
  weighEl.title = `Scale Logs: ${weighInCount} logs (Tap for targets)`;
}

// 2. Web Audio Synthesizer sound effect ticks
function triggerSetCompleteBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = "sine";
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.15);
    
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch (e) {
    console.log("Web Audio synth beep blocked or not supported on this device:", e);
  }
}

// 3. Spawns Flying CSS Spark particles
// 3. Spawns Flying CSS Spark particles
function triggerExplosionAnimation(x, y) {
  const particleCount = 12;
  const container = document.body;
  
  for (let i = 0; i < particleCount; i++) {
    const spark = document.createElement("div");
    spark.className = "spark-spark";
    
    const angle = Math.random() * Math.PI * 2;
    const velocity = 40 + Math.random() * 50;
    const dx = Math.cos(angle) * velocity;
    const dy = Math.sin(angle) * velocity;
    
    spark.style.left = `${x}px`;
    spark.style.top = `${y}px`;
    
    // Inject dynamic keyframe stylesheet for WebKit compatibility
    const animId = `explode-anim-${Math.random().toString(36).substr(2, 9)}`;
    const keyframes = `
      @keyframes ${animId} {
        0% {
          transform: translate3d(0, 0, 0) scale(1);
          opacity: 1;
        }
        100% {
          transform: translate3d(${dx}px, ${dy}px, 0) scale(0.2);
          opacity: 0;
        }
      }
      @-webkit-keyframes ${animId} {
        0% {
          -webkit-transform: translate3d(0, 0, 0) scale(1);
          opacity: 1;
        }
        100% {
          -webkit-transform: translate3d(${dx}px, ${dy}px, 0) scale(0.2);
          opacity: 0;
        }
      }
    `;
    
    const styleSheet = document.createElement("style");
    styleSheet.innerText = keyframes;
    document.head.appendChild(styleSheet);
    
    spark.style.animation = `${animId} 0.5s cubic-bezier(0.1, 0.8, 0.25, 1) forwards`;
    spark.style.webkitAnimation = `${animId} 0.5s cubic-bezier(0.1, 0.8, 0.25, 1) forwards`;
    
    container.appendChild(spark);
    
    setTimeout(() => {
      spark.remove();
      styleSheet.remove();
    }, 500);
  }
}

function triggerSparklingAnimation(x, y) {
  const colors = ["#ff5500", "#ff7300", "#ffaa00", "#e63900", "#ff3c00"];
  const particleCount = 36; // Denser angle-grinder spark shower!
  const container = document.body;
  
  // Spawn particles progressively over 500ms to match the gear's spin rotation!
  for (let i = 0; i < particleCount; i++) {
    setTimeout(() => {
      const wrap = document.createElement("div");
      wrap.className = "setting-spark-wrap";
      
      // Angle increments progressively to create a spinning spiral emitter effect!
      const spinAngle = (i * (Math.PI * 2 / 18)) + (Math.random() * 0.3);
      const velocity = 150 + Math.random() * 200; // Ultra high-speed explosive spray!
      const dx = Math.cos(spinAngle) * velocity;
      const dy = Math.sin(spinAngle) * velocity;
      
      // Parabolic horizontal drift (sideways air curve)
      const drift = (Math.random() - 0.5) * 120;
      
      // Gravity drop distance
      const g = 250;
      
      // Start and End vector math to steer (rotate) the streak along the parabolic path
      const vx_final = dx * 0.95 + drift;
      const vy_final = dy + g;
      const radStart = spinAngle + Math.PI / 2;
      const radEnd = Math.atan2(vy_final, vx_final) + Math.PI / 2;
      
      wrap.style.left = `${x}px`;
      wrap.style.top = `${y}px`;
      
      const core = document.createElement("div");
      core.className = "setting-spark-core";
      
      const color = colors[Math.floor(Math.random() * colors.length)];
      const scaleY = 1.4 + Math.random() * 1.8; // Physically stretched streaks
      
      // Dynamically inject custom keyframes for this spark to support iOS Safari (WebKit bug workaround)
      const animId = `spark-anim-${Math.random().toString(36).substr(2, 9)}`;
      const keyframes = `
        @keyframes ${animId} {
          0% {
            transform: translate3d(0, 0, 0) rotate(${radStart}rad) scaleY(0.1);
            box-shadow: 0 0 4px ${color}, 0 0 1px #ffffff;
            background: linear-gradient(to top, rgba(255, 50, 0, 0) 0%, rgba(255, 100, 0, 0.4) 20%, ${color} 60%, #ffffff 100%);
            opacity: 1;
          }
          20% {
            transform: translate3d(${dx * 0.28}px, ${dy * 0.28 + g * 0.0625}px, 0) rotate(${radStart * 0.8 + radEnd * 0.2}rad) scaleY(${scaleY});
            box-shadow: 0 0 5px ${color}, 0 0 1.5px #ffffff;
            background: linear-gradient(to top, rgba(255, 50, 0, 0) 0%, rgba(255, 100, 0, 0.4) 20%, ${color} 60%, #ffffff 100%);
          }
          70% {
            transform: translate3d(${dx * 0.53}px, ${dy * 0.53 + g * 0.25}px, 0) rotate(${radStart * 0.35 + radEnd * 0.65}rad) scaleY(${scaleY});
            box-shadow: 0 0 5px ${color}, 0 0 1.5px #ffffff;
            background: linear-gradient(to top, rgba(255, 50, 0, 0) 0%, rgba(255, 100, 0, 0.4) 20%, ${color} 60%, #ffffff 100%);
            opacity: 0.95;
          }
          75% {
            transform: translate3d(${dx * 0.78}px, ${dy * 0.78 + g * 0.5625}px, 0) rotate(${radStart * 0.15 + radEnd * 0.85}rad) scaleY(0.25);
            box-shadow: 0 0 6px ${color}, 0 0 2px #ffffff;
            background: #ffffff;
            opacity: 1;
          }
          80% {
            transform: translate3d(${dx * 0.95}px, ${dy + g}px, 0) rotate(${radEnd}rad) scaleY(0.15);
            background: #ffffff;
            box-shadow: 
              0 0 5px ${color},
              -4px -4px 3px ${color},
              4px -4px 3px ${color},
              -4px 4px 3px ${color},
              4px 4px 3px ${color};
            opacity: 1;
          }
          100% {
            transform: translate3d(${dx * 0.95 + drift}px, ${dy + g}px, 0) rotate(${radEnd}rad) scaleY(0.01);
            background: transparent;
            box-shadow: 
              0 0 2px ${color},
              -12px -12px 6px transparent,
              12px -12px 6px transparent,
              -12px 12px 6px transparent,
              12px 12px 6px transparent;
            opacity: 0;
          }
        }
        @-webkit-keyframes ${animId} {
          0% {
            -webkit-transform: translate3d(0, 0, 0) rotate(${radStart}rad) scaleY(0.1);
            box-shadow: 0 0 4px ${color}, 0 0 1px #ffffff;
            background: linear-gradient(to top, rgba(255, 50, 0, 0) 0%, rgba(255, 100, 0, 0.4) 20%, ${color} 60%, #ffffff 100%);
            opacity: 1;
          }
          20% {
            -webkit-transform: translate3d(${dx * 0.28}px, ${dy * 0.28 + g * 0.0625}px, 0) rotate(${radStart * 0.8 + radEnd * 0.2}rad) scaleY(${scaleY});
            box-shadow: 0 0 5px ${color}, 0 0 1.5px #ffffff;
            background: linear-gradient(to top, rgba(255, 50, 0, 0) 0%, rgba(255, 100, 0, 0.4) 20%, ${color} 60%, #ffffff 100%);
          }
          70% {
            -webkit-transform: translate3d(${dx * 0.53}px, ${dy * 0.53 + g * 0.25}px, 0) rotate(${radStart * 0.35 + radEnd * 0.65}rad) scaleY(${scaleY});
            box-shadow: 0 0 5px ${color}, 0 0 1.5px #ffffff;
            background: linear-gradient(to top, rgba(255, 50, 0, 0) 0%, rgba(255, 100, 0, 0.4) 20%, ${color} 60%, #ffffff 100%);
            opacity: 0.95;
          }
          75% {
            -webkit-transform: translate3d(${dx * 0.78}px, ${dy * 0.78 + g * 0.5625}px, 0) rotate(${radStart * 0.15 + radEnd * 0.85}rad) scaleY(0.25);
            box-shadow: 0 0 6px ${color}, 0 0 2px #ffffff;
            background: #ffffff;
            opacity: 1;
          }
          80% {
            -webkit-transform: translate3d(${dx * 0.95}px, ${dy + g}px, 0) rotate(${radEnd}rad) scaleY(0.15);
            background: #ffffff;
            box-shadow: 
              0 0 5px ${color},
              -4px -4px 3px ${color},
              4px -4px 3px ${color},
              -4px 4px 3px ${color},
              4px 4px 3px ${color};
            opacity: 1;
          }
          100% {
            -webkit-transform: translate3d(${dx * 0.95 + drift}px, ${dy + g}px, 0) rotate(${radEnd}rad) scaleY(0.01);
            background: transparent;
            box-shadow: 
              0 0 2px ${color},
              -12px -12px 6px transparent,
              12px -12px 6px transparent,
              -12px 12px 6px transparent,
              12px 12px 6px transparent;
            opacity: 0;
          }
        }
      `;
      
      const styleSheet = document.createElement("style");
      styleSheet.innerText = keyframes;
      document.head.appendChild(styleSheet);
      
      core.style.animation = `${animId} 0.65s cubic-bezier(0.05, 0.6, 0.2, 1) forwards`;
      core.style.webkitAnimation = `${animId} 0.65s cubic-bezier(0.05, 0.6, 0.2, 1) forwards`;
      
      wrap.appendChild(core);
      container.appendChild(wrap);
      
      setTimeout(() => {
        wrap.remove();
        styleSheet.remove();
      }, 650); // Burns out fast matching high velocity
    }, i * 14); // 36 sparks over ~500ms
  }
}

// 4. rest Timer engine & Screen Wake Lock API (Removed as requested)


// 5. Procedurally generated Synthwave Beats loop sequencer
let synthwaveAudioCtx = null;
let synthwaveInterval = null;
let synthwaveStep = 0;

function startSynthwaveBeats() {
  if (state.synthPlaying) return;
  state.synthPlaying = true;
  
  try {
    synthwaveAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    synthwaveStep = 0;
    
    const stepDuration = 0.22; // bpm 136 rhythm pulse
    
    const playSequencerStep = () => {
      if (!state.synthPlaying || !synthwaveAudioCtx) return;
      const time = synthwaveAudioCtx.currentTime;
      
      // A. Kick Drum beats (Steps 0 and 4)
      if (synthwaveStep === 0 || synthwaveStep === 4) {
        const kickOsc = synthwaveAudioCtx.createOscillator();
        const kickGain = synthwaveAudioCtx.createGain();
        
        kickOsc.frequency.setValueAtTime(150, time);
        kickOsc.frequency.exponentialRampToValueAtTime(0.01, time + 0.12);
        
        kickGain.gain.setValueAtTime(0.3, time);
        kickGain.gain.exponentialRampToValueAtTime(0.01, time + 0.12);
        
        kickOsc.connect(kickGain);
        kickGain.connect(synthwaveAudioCtx.destination);
        kickOsc.start(time);
        kickOsc.stop(time + 0.12);
      }
      
      // B. White noise snare claps (Steps 2 and 6)
      if (synthwaveStep === 2 || synthwaveStep === 6) {
        const bufferSize = synthwaveAudioCtx.sampleRate * 0.15;
        const buffer = synthwaveAudioCtx.createBuffer(1, bufferSize, synthwaveAudioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }
        
        const noise = synthwaveAudioCtx.createBufferSource();
        noise.buffer = buffer;
        
        const filter = synthwaveAudioCtx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.value = 1000;
        
        const snareGain = synthwaveAudioCtx.createGain();
        snareGain.gain.setValueAtTime(0.12, time);
        snareGain.gain.exponentialRampToValueAtTime(0.01, time + 0.15);
        
        noise.connect(filter);
        filter.connect(snareGain);
        snareGain.connect(synthwaveAudioCtx.destination);
        
        noise.start(time);
        noise.stop(time + 0.15);
      }
      
      // C. Pulses synthesizer bass note on every step (Binaural retro Synthwave)
      const bassNotes = [55.0, 55.0, 65.41, 65.41, 73.42, 73.42, 98.0, 82.41]; // retro scale: A1, A1, C2, C2, D2, D2, G2, E2
      const freq = bassNotes[synthwaveStep % bassNotes.length];
      
      const bassOsc = synthwaveAudioCtx.createOscillator();
      const bassGain = synthwaveAudioCtx.createGain();
      const filter = synthwaveAudioCtx.createBiquadFilter();
      
      bassOsc.type = "sawtooth";
      bassOsc.frequency.setValueAtTime(freq, time);
      
      filter.type = "lowpass";
      const sweepFreq = 300 + Math.sin(time * 0.5) * 150; // Dynamic filter sweep modulation
      filter.frequency.setValueAtTime(sweepFreq, time);
      
      bassGain.gain.setValueAtTime(0.08, time);
      bassGain.gain.exponentialRampToValueAtTime(0.01, time + stepDuration * 0.9);
      
      bassOsc.connect(filter);
      filter.connect(bassGain);
      bassGain.connect(synthwaveAudioCtx.destination);
      
      bassOsc.start(time);
      bassOsc.stop(time + stepDuration * 0.9);
      
      synthwaveStep = (synthwaveStep + 1) % 8;
    };
    
    playSequencerStep();
    synthwaveInterval = setInterval(playSequencerStep, stepDuration * 1000);
    
    const chk = document.getElementById("chkSynthwave");
    if (chk) chk.checked = true;
    const btn = document.getElementById("btnToggleSynthwave");
    if (btn) {
      btn.innerHTML = "🔊 ON";
      btn.className = "btn btn-cyan btn-sm";
    }
  } catch (e) {
    console.log("Procedural synthwave failed to start:", e);
    state.synthPlaying = false;
  }
}

function stopSynthwaveBeats() {
  if (!state.synthPlaying) return;
  state.synthPlaying = false;
  
  if (synthwaveInterval) {
    clearInterval(synthwaveInterval);
    synthwaveInterval = null;
  }
  
  if (synthwaveAudioCtx) {
    synthwaveAudioCtx.close();
    synthwaveAudioCtx = null;
  }
  
  const chk = document.getElementById("chkSynthwave");
  if (chk) chk.checked = false;
  const btn = document.getElementById("btnToggleSynthwave");
  if (btn) {
    btn.innerHTML = "🔇 OFF";
    btn.className = "btn btn-secondary btn-sm";
  }
}
