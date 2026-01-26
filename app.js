// ============================================
// CONFIGURATION - Update these values
// ============================================

const SUPABASE_URL = 'https://pyplwpohrszraafvfobf.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5cGx3cG9ocnN6cmFhZnZmb2JmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3MTE2NjksImV4cCI6MjA3MTI4NzY2OX0.VKZ8OZj2uuFgpnpeBCld_zijeCZw3OQE-ERUrflBrt0';

// Campus lunch spots from Pocket Guide 2025
// Each spot has a name and location
const DEFAULT_LUNCH_SPOTS = [
  { name: 'Himalaya', location: 'Food Hall 4' },
  { name: 'Global', location: 'Food Hall 4' },
  { name: 'Forage', location: 'Food Hall 4' },
  { name: 'Roost', location: 'Food Hall 4' },
  { name: 'Cuatro', location: 'Food Hall 4' },
  { name: 'Parlor', location: 'Food Hall 4' },
  { name: 'Delicatessen', location: 'Food Hall 4' },
  { name: 'Eat Local (4)', location: 'Food Hall 4' },
  { name: "Jack's BBQ", location: 'Food Hall 4' },
  { name: "Joe's Burgers", location: 'Food Hall 4' },
  { name: 'Just Poké', location: 'Food Hall 4' },
  { name: 'Paparepas', location: 'Food Hall 4' },
  { name: 'MiLá', location: 'Food Hall 4' },
  { name: 'Craft75', location: 'Food Hall 6' },
  { name: 'Pranzetto', location: 'Food Hall 6' },
  { name: 'Eat Local (6)', location: 'Food Hall 6' },
  { name: 'Grilled', location: 'Food Hall 6' },
  { name: 'Mediterranean', location: 'Food Hall 6' },
  { name: 'Street Food', location: 'Food Hall 6' },
  { name: 'World Flavors', location: 'Food Hall 6' },
  { name: 'Sprout', location: 'Food Hall 6' },
  { name: 'OmaBap', location: 'Food Hall 6' },
  { name: 'Flora', location: 'Food Hall 6' },
  { name: 'Cone & Steiner', location: 'Building 8' },
  { name: 'Diner', location: 'Food Hall 9' },
  { name: 'Soul Pie', location: 'Food Hall 9' },
  { name: 'Internationalist', location: 'Food Hall 9' },
  { name: 'PNW', location: 'Food Hall 9' },
  { name: 'Garden', location: 'Food Hall 9' },
  { name: 'Sea', location: 'Food Hall 9' },
  { name: 'Pacific Rim', location: 'Food Hall 9' },
  { name: 'Leaf + Land', location: 'Food Hall 9' },
  { name: 'Big Chicken', location: 'Food Hall 9' },
];

// ============================================
// APP CODE
// ============================================

let supabaseClient;
try {
  supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
  );
} catch (e) {
  console.error('Failed to initialize Supabase:', e);
}

const wheel = document.getElementById('wheel');
const wheelContainer = document.querySelector('.wheel-container');
const spinBtn = document.getElementById('spinBtn');
const resultText = document.getElementById('result-text');
const historyList = document.getElementById('history-list');
const resultPopover = document.getElementById('result-popover');

// Group UI
const groupSelect = document.getElementById('groupSelect');
const currentGroupLabel = document.getElementById('currentGroupLabel');
const newGroupNameInput = document.getElementById('newGroupName');
const createGroupBtn = document.getElementById('createGroupBtn');
const newSpotNameInput = document.getElementById('newSpotName');
const newSpotLocationInput = document.getElementById('newSpotLocation');
const addSpotBtn = document.getElementById('addSpotBtn');
const spotsList = document.getElementById('spots-list');
const resetSpotsBtn = document.getElementById('resetSpotsBtn');

let currentRotation = 0;
let todaysPick = null;
let yesterdaysPick = null;

let selectedGroup = null;
let activeLunchSpots = [];
let supabaseGroupModeAvailable = true;

// Get today's date as YYYY-MM-DD
const getToday = () => new Date().toISOString().split('T')[0];

const STORAGE_PREFIX = 'lunchWheel.';
const storageKey = (suffix) => `${STORAGE_PREFIX}${suffix}`;

function safeTrim(str) {
  return (str ?? '').toString().trim();
}

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function normalizeGroupName(name) {
  return safeTrim(name).replace(/\s+/g, ' ');
}

function getGroups() {
  const groups = loadJSON(storageKey('groups'), ['Edge design']);
  const normalized = [
    ...new Set(groups.map(normalizeGroupName).filter(Boolean)),
  ];
  return normalized.length ? normalized : ['Edge design'];
}

function persistGroups(groups) {
  saveJSON(storageKey('groups'), groups);
}

function getSelectedGroup() {
  const fromStorage = normalizeGroupName(
    loadJSON(storageKey('selectedGroup'), ''),
  );
  const groups = getGroups();
  if (fromStorage && groups.includes(fromStorage)) return fromStorage;
  return groups[0];
}

function setSelectedGroup(groupName) {
  selectedGroup = groupName;
  saveJSON(storageKey('selectedGroup'), groupName);
  if (currentGroupLabel) currentGroupLabel.textContent = groupName;
}

function getGroupSpotsKey(groupName) {
  return storageKey(`spots.${groupName}`);
}

function getGroupHistoryKey(groupName) {
  return storageKey(`history.${groupName}`);
}

function getSpotsForGroup(groupName) {
  const custom = loadJSON(getGroupSpotsKey(groupName), null);
  if (Array.isArray(custom) && custom.length) {
    return custom
      .map((s) => ({
        name: safeTrim(s?.name),
        location: safeTrim(s?.location),
      }))
      .filter((s) => s.name);
  }
  return DEFAULT_LUNCH_SPOTS;
}

function setSpotsForGroup(groupName, spots) {
  const cleaned = (spots || [])
    .map((s) => ({ name: safeTrim(s?.name), location: safeTrim(s?.location) }))
    .filter((s) => s.name);
  saveJSON(getGroupSpotsKey(groupName), cleaned);
}

function resetSpotsForGroup(groupName) {
  localStorage.removeItem(getGroupSpotsKey(groupName));
}

function readLocalHistory(groupName) {
  const history = loadJSON(getGroupHistoryKey(groupName), []);
  if (!Array.isArray(history)) return [];
  return history
    .filter((h) => h && h.pick_date && h.spot_name)
    .sort((a, b) =>
      a.pick_date < b.pick_date ? 1 : a.pick_date > b.pick_date ? -1 : 0,
    )
    .slice(0, 7);
}

function writeLocalPick(groupName, pickDate, spotName) {
  const history = loadJSON(getGroupHistoryKey(groupName), []);
  const next = Array.isArray(history) ? [...history] : [];
  const existingIndex = next.findIndex((h) => h.pick_date === pickDate);
  const entry = { pick_date: pickDate, spot_name: spotName };
  if (existingIndex >= 0) next[existingIndex] = entry;
  else next.push(entry);
  saveJSON(getGroupHistoryKey(groupName), next);
}

function isMissingColumnError(error, columnName) {
  const msg = `${error?.message || ''} ${error?.details || ''}`.toLowerCase();
  return msg.includes('column') && msg.includes(columnName.toLowerCase());
}

// Build the wheel segments
function buildWheel() {
  const numSegments = activeLunchSpots.length;
  const segmentAngle = 360 / numSegments;

  // Color palette - will cycle through for any number of segments
  const colors = [
    '#e63946',
    '#f4a261',
    '#2a9d8f',
    '#264653',
    '#e9c46a',
    '#9b59b6',
    '#3498db',
    '#1abc9c',
    '#e91e63',
    '#00bcd4',
    '#ff9800',
    '#8bc34a',
    '#ff5722',
    '#607d8b',
    '#673ab7',
    '#009688',
    '#ffc107',
    '#795548',
    '#f44336',
    '#4caf50',
  ];

  // Light colors that need dark text
  const lightColors = ['#e9c46a', '#f4a261', '#ffc107', '#8bc34a', '#4caf50'];

  // Build conic gradient dynamically starting at top
  let gradientStops = [];
  for (let i = 0; i < numSegments; i++) {
    const color = colors[i % colors.length];
    const startAngle = i * segmentAngle;
    const endAngle = (i + 1) * segmentAngle;
    gradientStops.push(`${color} ${startAngle}deg ${endAngle}deg`);
  }
  wheel.style.background = `conic-gradient(from -90deg, ${gradientStops.join(', ')})`;

  // Calculate font size based on wheel size + number of segments,
  // then cap it to the available segment width at the chosen label radius.
  const wheelSize = wheel.getBoundingClientRect().width || 600;

  // Push labels away from center circle but keep them inside the rim.
  const minRadius = 55; // center circle (~30px radius) + padding
  const maxRadius = Math.max(minRadius + 10, wheelSize / 2 - 26);
  const preferredRadius = wheelSize * 0.34;
  const labelRadius = Math.max(minRadius, Math.min(preferredRadius, maxRadius));

  // Segment width (arc length) at the label radius; use ~80% to avoid overlap.
  const segmentWidthAtRadius = (2 * Math.PI * labelRadius * segmentAngle) / 360;
  const maxFontPx = Math.max(10, Math.floor(segmentWidthAtRadius * 0.8));

  const desiredBasePx =
    numSegments > 35 ? 13 : numSegments > 25 ? 16 : numSegments > 15 ? 19 : 24;
  const scale = Math.max(1.0, Math.min(wheelSize / 600, 1.7));
  const desiredFontPx = Math.round(desiredBasePx * scale);
  const fontSize = `${Math.min(desiredFontPx, maxFontPx)}px`;

  // Add text labels - segment i spans from i*segmentAngle to (i+1)*segmentAngle
  // Center of segment i is at i*segmentAngle + segmentAngle/2, offset by -90 for top start
  let labelsHTML = '';
  for (let i = 0; i < numSegments; i++) {
    const segmentCenter = i * segmentAngle + segmentAngle / 2;
    const labelAngle = segmentCenter - 90;
    const color = colors[i % colors.length];
    const textColor = lightColors.includes(color) ? '#000' : '#fff';
    const spot = activeLunchSpots[i];
    const tooltip = `${spot.name} — ${spot.location}`;
    labelsHTML += `<div class="segment-label" style="--label-angle: ${labelAngle}deg; --label-radius: ${labelRadius}px; color: ${textColor}; font-size: ${fontSize};" title="${tooltip}"><span>${spot.name}</span></div>`;
  }
  wheel.innerHTML = labelsHTML;
  console.log('Wheel built with', numSegments, 'segments');
}

function sizeWheelToContainer() {
  if (!wheel || !wheelContainer) return;

  const styles = window.getComputedStyle(wheelContainer);
  const paddingX =
    parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
  const paddingY =
    parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom);

  const availableWidth = wheelContainer.clientWidth - paddingX;
  const availableHeight = wheelContainer.clientHeight - paddingY;
  const margin = 8;

  const wheelSize = Math.max(
    240,
    Math.floor(Math.min(availableWidth, availableHeight) - margin * 2),
  );

  wheel.style.width = `${wheelSize}px`;
  wheel.style.height = `${wheelSize}px`;
  wheelContainer.style.setProperty('--wheel-size', `${wheelSize}px`);

  return wheelSize;
}

// Get available spots (excluding yesterday's pick)
function getAvailableSpots() {
  if (!Array.isArray(activeLunchSpots) || activeLunchSpots.length === 0) {
    return [];
  }
  if (!yesterdaysPick) return activeLunchSpots;
  return activeLunchSpots.filter((spot) => spot.name !== yesterdaysPick);
}

// Spin the wheel to a specific spot
function spinToSpot(spot) {
  const spotIndex = activeLunchSpots.findIndex((s) => s.name === spot.name);
  const segmentAngle = 360 / activeLunchSpots.length;

  // Calculate target angle (spot should be at top, under pointer)
  const targetAngle = -(spotIndex * segmentAngle);

  // Add extra rotations for dramatic effect
  const extraRotations = 5 * 360;
  const randomOffset = (Math.random() - 0.5) * (segmentAngle * 0.5);

  // Reset transition and apply spin
  wheel.style.transition = 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)';
  currentRotation = extraRotations + targetAngle + randomOffset;
  wheel.style.transform = `rotate(${currentRotation}deg)`;

  return new Promise((resolve) => setTimeout(resolve, 4000));
}

// Load history (Supabase if available + schema supports groups, else local)
async function loadHistory(groupName) {
  if (!supabaseClient || !supabaseGroupModeAvailable) {
    return readLocalHistory(groupName);
  }

  const { data, error } = await supabaseClient
    .from('lunch_picks')
    .select('*')
    .eq('group_name', groupName)
    .order('pick_date', { ascending: false })
    .limit(7);

  if (error) {
    if (isMissingColumnError(error, 'group_name')) {
      console.warn(
        'Supabase table is missing group_name. Falling back to local storage. See README for migration SQL.',
      );
      supabaseGroupModeAvailable = false;
      return readLocalHistory(groupName);
    }

    console.error('Error loading history:', error);
    return readLocalHistory(groupName);
  }

  return data || [];
}

// Save pick (Supabase if available + schema supports groups, else local)
async function savePick(groupName, spotName) {
  const pickDate = getToday();

  if (!supabaseClient || !supabaseGroupModeAvailable) {
    writeLocalPick(groupName, pickDate, spotName);
    return;
  }

  const { error } = await supabaseClient.from('lunch_picks').insert({
    group_name: groupName,
    pick_date: pickDate,
    spot_name: spotName,
  });

  if (error) {
    if (isMissingColumnError(error, 'group_name')) {
      console.warn(
        'Supabase table is missing group_name. Falling back to local storage. See README for migration SQL.',
      );
      supabaseGroupModeAvailable = false;
      writeLocalPick(groupName, pickDate, spotName);
      return;
    }

    console.error('Error saving pick:', error);
    writeLocalPick(groupName, pickDate, spotName);
  }
}

// Render history list
function renderHistory(history) {
  const today = getToday();

  if (history.length === 0) {
    historyList.innerHTML = '<li class="no-history">No picks yet!</li>';
    return;
  }

  historyList.innerHTML = history
    .map(
      (pick) => `
        <li>
            <span class="spot">${pick.spot_name}</span>
            <span class="date ${pick.pick_date === today ? 'today' : ''}">${formatDate(pick.pick_date)}</span>
        </li>
    `,
    )
    .join('');
}

// Format date for display
function formatDate(dateStr) {
  const date = new Date(dateStr + 'T12:00:00');
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (dateStr === getToday()) return 'Today';
  if (dateStr === yesterday.toISOString().split('T')[0]) return 'Yesterday';

  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

// Check if already spun today
async function checkTodaysPick(history) {
  const today = getToday();
  const todayEntry = history.find((h) => h.pick_date === today);

  if (todayEntry) {
    todaysPick = todayEntry.spot_name;
    return true;
  }
  return false;
}

// Get yesterday's pick
function getYesterdaysPick(history) {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const yesterdayEntry = history.find((h) => h.pick_date === yesterdayStr);
  return yesterdayEntry?.spot_name || null;
}

// Disable the wheel and button
function disableWheel() {
  spinBtn.disabled = true;
  spinBtn.textContent = 'Already Spun Today!';
  wheel.classList.add('disabled');
}

function enableWheel() {
  spinBtn.disabled = false;
  spinBtn.textContent = 'Spin!';
  wheel.classList.remove('disabled');
  wheel.style.cursor = 'grab';
}

// Show today's result
function showResult(spot) {
  if (typeof spot === 'string') {
    // Legacy format (from history) - just show name
    resultText.textContent = spot;
  } else {
    // Object format - show name and location
    resultText.innerHTML = `${spot.name}<br><small style="opacity: 0.7; font-size: 0.6em;">${spot.location}</small>`;
  }
  resultPopover.showPopover();
}

// Handle spin
async function handleSpin() {
  console.log('Spin clicked');
  if (spinBtn.disabled) return;

  spinBtn.disabled = true;
  spinBtn.textContent = 'Spinning...';
  wheel.style.cursor = 'not-allowed';

  // Pick a random spot from available options
  const available = getAvailableSpots();
  if (!available.length) {
    console.warn('No available spots to pick from');
    enableWheel();
    return;
  }
  const picked = available[Math.floor(Math.random() * available.length)];
  console.log('Picked:', picked.name);

  // Spin animation
  await spinToSpot(picked);
  console.log('Spin animation complete');

  // Show result immediately
  todaysPick = picked.name;
  showResult(picked);
  disableWheel();

  // Save to database (don't block on this)
  try {
    await savePick(selectedGroup, picked.name);
    const history = await loadHistory(selectedGroup);
    renderHistory(history);
  } catch (err) {
    console.error('Failed to save pick:', err);
  }
}

// Drag-to-spin gesture
let isDragging = false;
let startAngle = 0;
let dragStartRotation = 0;

function getAngleFromCenter(e) {
  const rect = wheel.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const x = (e.clientX || e.touches?.[0]?.clientX) - centerX;
  const y = (e.clientY || e.touches?.[0]?.clientY) - centerY;
  return Math.atan2(y, x) * (180 / Math.PI);
}

function handleDragStart(e) {
  if (spinBtn.disabled) return;
  e.preventDefault();
  isDragging = true;
  startAngle = getAngleFromCenter(e);
  dragStartRotation = currentRotation;
  wheel.style.transition = 'none';
  wheel.style.cursor = 'grabbing';
}

function handleDragMove(e) {
  if (!isDragging) return;
  e.preventDefault();
  const currentAngle = getAngleFromCenter(e);
  const deltaAngle = currentAngle - startAngle;
  currentRotation = dragStartRotation + deltaAngle;
  wheel.style.transform = `rotate(${currentRotation}deg)`;
}

function handleDragEnd(e) {
  if (!isDragging) return;
  isDragging = false;
  wheel.style.cursor = 'grab';

  // Calculate velocity based on drag distance
  const endAngle = getAngleFromCenter(e);
  const dragDistance = Math.abs(endAngle - startAngle);

  // If dragged enough, trigger spin
  if (dragDistance > 30) {
    handleSpin();
  }
}

function setupDragGesture() {
  wheel.style.cursor = 'grab';

  // Mouse events
  wheel.addEventListener('mousedown', handleDragStart);
  document.addEventListener('mousemove', handleDragMove);
  document.addEventListener('mouseup', handleDragEnd);

  // Touch events
  wheel.addEventListener('touchstart', handleDragStart, { passive: false });
  document.addEventListener('touchmove', handleDragMove, { passive: false });
  document.addEventListener('touchend', handleDragEnd);
}

function renderSpotsManager() {
  if (!spotsList) return;
  const spots = getSpotsForGroup(selectedGroup);
  spotsList.innerHTML = spots
    .map((spot, index) => {
      const location = safeTrim(spot.location);
      return `
      <li>
        <div class="spot-meta">
          <div class="name">${spot.name}</div>
          ${location ? `<div class="location">${location}</div>` : ''}
        </div>
        <button class="remove-btn" data-index="${index}" aria-label="Remove">Remove</button>
      </li>
    `;
    })
    .join('');

  spotsList.querySelectorAll('button.remove-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.getAttribute('data-index'));
      const next = spots.filter((_, i) => i !== idx);
      setSpotsForGroup(selectedGroup, next);
      applyGroupContext();
    });
  });
}

function rebuildGroupSelect() {
  if (!groupSelect) return;

  const groups = getGroups();
  groupSelect.innerHTML = groups
    .map((g) => `<option value="${g}">${g}</option>`)
    .join('');

  const current = getSelectedGroup();
  groupSelect.value = current;
}

async function applyGroupContext() {
  if (!selectedGroup) return;

  todaysPick = null;
  yesterdaysPick = null;
  currentRotation = 0;

  activeLunchSpots = getSpotsForGroup(selectedGroup);
  if (!activeLunchSpots.length) {
    activeLunchSpots = DEFAULT_LUNCH_SPOTS;
  }
  sizeWheelToContainer();
  buildWheel();
  renderSpotsManager();

  try {
    const history = await loadHistory(selectedGroup);
    renderHistory(history);

    yesterdaysPick = getYesterdaysPick(history);
    const alreadySpun = await checkTodaysPick(history);

    if (alreadySpun) {
      disableWheel();
      wheel.style.cursor = 'not-allowed';
      const spotIndex = activeLunchSpots.findIndex(
        (s) => s.name === todaysPick,
      );
      if (spotIndex >= 0) {
        const segmentAngle = 360 / activeLunchSpots.length;
        wheel.style.transition = 'none';
        wheel.style.transform = `rotate(${-(spotIndex * segmentAngle)}deg)`;
      }
    } else {
      enableWheel();
      wheel.style.transition = 'none';
      wheel.style.transform = 'rotate(0deg)';
    }
  } catch (err) {
    console.error('Failed to apply group context:', err);
  }
}

function setupGroupUi() {
  rebuildGroupSelect();

  const initial = getSelectedGroup();
  setSelectedGroup(initial);

  if (groupSelect) {
    groupSelect.addEventListener('change', async () => {
      const next = normalizeGroupName(groupSelect.value);
      if (!next) return;
      setSelectedGroup(next);
      await applyGroupContext();
    });
  }

  if (createGroupBtn && newGroupNameInput) {
    createGroupBtn.addEventListener('click', async () => {
      const name = normalizeGroupName(newGroupNameInput.value);
      if (!name) return;

      const groups = getGroups();
      if (!groups.includes(name)) {
        groups.push(name);
        persistGroups(groups);
      }

      rebuildGroupSelect();
      groupSelect.value = name;
      newGroupNameInput.value = '';
      setSelectedGroup(name);
      await applyGroupContext();
    });

    newGroupNameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') createGroupBtn.click();
    });
  }

  if (addSpotBtn && newSpotNameInput && newSpotLocationInput) {
    addSpotBtn.addEventListener('click', () => {
      const name = safeTrim(newSpotNameInput.value);
      const location = safeTrim(newSpotLocationInput.value);
      if (!name) return;

      const spots = getSpotsForGroup(selectedGroup);
      const next = [...spots, { name, location }];
      setSpotsForGroup(selectedGroup, next);

      newSpotNameInput.value = '';
      newSpotLocationInput.value = '';
      applyGroupContext();
    });

    newSpotNameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addSpotBtn.click();
    });
  }

  if (resetSpotsBtn) {
    resetSpotsBtn.addEventListener('click', () => {
      resetSpotsForGroup(selectedGroup);
      applyGroupContext();
    });
  }
}

// Initialize app
async function init() {
  // Size & build the wheel dynamically
  setupGroupUi();

  let resizeTimer;
  window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      sizeWheelToContainer();
      buildWheel();
    }, 100);
  });

  // Attach click handler immediately
  spinBtn.addEventListener('click', handleSpin);
  setupDragGesture();
  console.log('Spin button and drag gesture attached');

  await applyGroupContext();
}

init();
