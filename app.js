// ============================================
// CONFIGURATION - Update these values
// ============================================

const SUPABASE_URL = 'https://pyplwpohrszraafvfobf.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5cGx3cG9ocnN6cmFhZnZmb2JmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3MTE2NjksImV4cCI6MjA3MTI4NzY2OX0.VKZ8OZj2uuFgpnpeBCld_zijeCZw3OQE-ERUrflBrt0';

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

const DEFAULT_GROUP_NAME = 'Edge design';

function safeTrim(str) {
  return (str ?? '').toString().trim();
}

function normalizeGroupName(name) {
  return safeTrim(name).replace(/\s+/g, ' ');
}

function getInitialGroupFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    return normalizeGroupName(params.get('group'));
  } catch {
    return '';
  }
}

async function setSelectedGroup(groupName, { updateUrl = true } = {}) {
  selectedGroup = groupName;
  if (currentGroupLabel) currentGroupLabel.textContent = groupName;
  await rebuildGroupSelect();

  if (updateUrl) {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('group', groupName);
      window.history.replaceState({}, '', url.toString());
    } catch {
      // best effort
    }
  }
}

function isMissingTableError(error, tableName) {
  const msg = `${error?.message || ''} ${error?.details || ''}`.toLowerCase();
  return (
    msg.includes('does not exist') &&
    msg.includes((tableName || '').toLowerCase())
  );
}

async function getGroupsFromSupabase() {
  if (!supabaseClient) return [DEFAULT_GROUP_NAME];

  // Preferred: explicit groups table
  const { data: groupsData, error: groupsError } = await supabaseClient
    .from('lunch_groups')
    .select('group_name')
    .order('group_name', { ascending: true });

  if (!groupsError) {
    const fromGroupsTable = (groupsData || [])
      .map((row) => normalizeGroupName(row?.group_name))
      .filter(Boolean);
    const unique = [...new Set(fromGroupsTable)];
    if (unique.length) return unique;

    // Seed a default group if table exists but empty
    await ensureGroupExists(DEFAULT_GROUP_NAME);
    return [DEFAULT_GROUP_NAME];
  }

  // Fallback: infer groups from picks table (still Supabase-only)
  if (!isMissingTableError(groupsError, 'lunch_groups')) {
    console.warn(
      'Failed to read lunch_groups; falling back to lunch_picks:',
      groupsError,
    );
  }

  if (!supabaseGroupModeAvailable) {
    return [DEFAULT_GROUP_NAME];
  }

  const { data: picksData, error: picksError } = await supabaseClient
    .from('lunch_picks')
    .select('group_name')
    .limit(1000);

  if (picksError) {
    if (isMissingColumnError(picksError, 'group_name')) {
      supabaseGroupModeAvailable = false;
      return [DEFAULT_GROUP_NAME];
    }
    console.error('Failed to infer groups from lunch_picks:', picksError);
    return [DEFAULT_GROUP_NAME];
  }

  const unique = [
    ...new Set(
      (picksData || [])
        .map((row) => normalizeGroupName(row?.group_name))
        .filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b));

  return unique.length ? unique : [DEFAULT_GROUP_NAME];
}

async function ensureGroupExists(groupName) {
  if (!supabaseClient) return;
  const normalized = normalizeGroupName(groupName);
  if (!normalized) return;

  const { error } = await supabaseClient
    .from('lunch_groups')
    .upsert({ group_name: normalized }, { onConflict: 'group_name' });

  if (error && !isMissingTableError(error, 'lunch_groups')) {
    console.warn('Failed to upsert group into lunch_groups:', error);
  }
}

async function getSpotsFromSupabase(groupName) {
  if (!supabaseClient) return [];

  const normalized = normalizeGroupName(groupName);
  if (!normalized) return [];

  const { data, error } = await supabaseClient
    .from('lunch_spots')
    .select('id, spot_name, location')
    .eq('group_name', normalized)
    .order('spot_name', { ascending: true });

  if (error) {
    if (isMissingTableError(error, 'lunch_spots')) {
      console.warn(
        'Missing lunch_spots table. Create it per README to persist spots in Supabase.',
      );
      return [];
    }
    console.error('Error loading spots:', error);
    return [];
  }

  const spots = (data || [])
    .map((row) => ({
      id: row.id,
      name: safeTrim(row.spot_name),
      location: safeTrim(row.location),
    }))
    .filter((s) => s.name);

  return spots.length ? spots : [];
}

async function replaceGroupSpotsInSupabase(groupName, spots) {
  if (!supabaseClient) return;
  const normalized = normalizeGroupName(groupName);
  if (!normalized) return;

  const { error: deleteError } = await supabaseClient
    .from('lunch_spots')
    .delete()
    .eq('group_name', normalized);

  if (deleteError) {
    if (isMissingTableError(deleteError, 'lunch_spots')) {
      console.warn(
        'Missing lunch_spots table. Create it per README to persist spots in Supabase.',
      );
      return;
    }
    throw deleteError;
  }

  const cleaned = (spots || [])
    .map((s) => ({ name: safeTrim(s?.name), location: safeTrim(s?.location) }))
    .filter((s) => s.name);

  if (!cleaned.length) return;

  const { error: insertError } = await supabaseClient
    .from('lunch_spots')
    .insert(
      cleaned.map((s) => ({
        group_name: normalized,
        spot_name: s.name,
        location: s.location || null,
      })),
    );

  if (insertError) throw insertError;
}

async function addSpotToSupabase(groupName, spot) {
  if (!supabaseClient) return;
  const normalized = normalizeGroupName(groupName);
  const name = safeTrim(spot?.name);
  const location = safeTrim(spot?.location);
  if (!normalized || !name) return;

  const { error } = await supabaseClient.from('lunch_spots').insert({
    group_name: normalized,
    spot_name: name,
    location: location || null,
  });

  if (error) {
    if (isMissingTableError(error, 'lunch_spots')) {
      console.warn(
        'Missing lunch_spots table. Create it per README to persist spots in Supabase.',
      );
      return;
    }
    console.error('Failed to add spot:', error);
  }
}

async function deleteSpotFromSupabase(spotId) {
  if (!supabaseClient || !spotId) return;
  const { error } = await supabaseClient
    .from('lunch_spots')
    .delete()
    .eq('id', spotId);
  if (error) {
    if (isMissingTableError(error, 'lunch_spots')) {
      console.warn(
        'Missing lunch_spots table. Create it per README to persist spots in Supabase.',
      );
      return;
    }
    console.error('Failed to delete spot:', error);
  }
}

function sectorClipPolygon({
  n,
  arcSteps = 48,
  orientation = 0 /* radians, 0 = 3 o'clock */,
}) {
  const theta = (2 * Math.PI) / n; // full slice angle
  const a = theta / 2; // half-angle
  const start = orientation - a;
  const end = orientation + a;

  // scale: full-size div: center (50,50), radius = 50
  const cx = 50,
    cy = 50,
    r = 50;

  const pts = [];
  pts.push(`${cx}% ${cy}%`); // center first

  for (let i = 0; i <= arcSteps; i++) {
    const t = start + (i / arcSteps) * (end - start);
    const x = cx + r * Math.cos(t);
    const y = cy - r * Math.sin(t); // CSS y down => subtract
    pts.push(`${x.toFixed(2)}% ${y.toFixed(2)}%`);
  }

  return `polygon(${pts.join(', ')})`;
}

function isMissingColumnError(error, columnName) {
  const msg = `${error?.message || ''} ${error?.details || ''}`.toLowerCase();
  return msg.includes('column') && msg.includes(columnName.toLowerCase());
}

// Build the wheel segments
function buildWheel() {
  const numSegments = activeLunchSpots.length;

  // // Light colors that need dark text
  // const lightColors = ['#e9c46a', '#f4a261', '#ffc107', '#8bc34a', '#4caf50'];

  document.body.style.setProperty('--num-segments', numSegments);
  document.body.style.setProperty(
    '--segment-clip-path',
    sectorClipPolygon({ n: numSegments }),
  );

  // Add segments
  let labelsHTML = '';
  for (let i = 0; i < numSegments; i++) {
    const spot = activeLunchSpots[i];
    const tooltip = `${spot.name} — ${spot.location}`;
    labelsHTML += `<div class="segment ${numSegments === 1 ? 'only' : ''}" style="--i: ${i};" title="${tooltip}"><span>${spot.name}</span></div>`;
  }
  wheel.innerHTML = labelsHTML;
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
  if (!supabaseClient) return [];

  if (!supabaseGroupModeAvailable) {
    const { data, error } = await supabaseClient
      .from('lunch_picks')
      .select('*')
      .order('pick_date', { ascending: false })
      .limit(7);
    if (error) {
      console.error('Error loading history:', error);
      return [];
    }
    return data || [];
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
        'Supabase table is missing group_name. Switching to legacy single-group mode. See README for migration SQL.',
      );
      supabaseGroupModeAvailable = false;
      return loadHistory(groupName);
    }

    console.error('Error loading history:', error);
    return [];
  }

  return data || [];
}

// Save pick (Supabase if available + schema supports groups, else local)
async function savePick(groupName, spotName) {
  const pickDate = getToday();

  if (!supabaseClient) return;

  const payload = {
    pick_date: pickDate,
    spot_name: spotName,
  };
  if (supabaseGroupModeAvailable) payload.group_name = groupName;

  const { error } = await supabaseClient.from('lunch_picks').insert(payload);

  if (error) {
    if (
      supabaseGroupModeAvailable &&
      isMissingColumnError(error, 'group_name')
    ) {
      console.warn(
        'Supabase table is missing group_name. Switching to legacy single-group mode. See README for migration SQL.',
      );
      supabaseGroupModeAvailable = false;
      return savePick(groupName, spotName);
    }

    console.error('Error saving pick:', error);
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
  const spots = Array.isArray(activeLunchSpots) ? activeLunchSpots : [];
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
      const spot = spots[idx];
      if (!spot) return;
      if (spot.id) {
        deleteSpotFromSupabase(spot.id).then(applyGroupContext);
        return;
      }

      // If spots are defaults (no id), replace the full set in Supabase (if configured)
      const next = spots.filter((_, i) => i !== idx);
      replaceGroupSpotsInSupabase(selectedGroup, next)
        .then(applyGroupContext)
        .catch((err) => console.error('Failed to update spots:', err));
    });
  });
}

async function rebuildGroupSelect() {
  if (!groupSelect) return;

  const groups = await getGroupsFromSupabase();
  groupSelect.innerHTML = groups
    .map((g) => `<option value="${g}">${g}</option>`)
    .join('');

  if (selectedGroup && groups.includes(selectedGroup)) {
    groupSelect.value = selectedGroup;
  } else {
    groupSelect.value = groups[0] || DEFAULT_GROUP_NAME;
  }
}

async function applyGroupContext() {
  if (!selectedGroup) return;

  todaysPick = null;
  yesterdaysPick = null;
  currentRotation = 0;

  activeLunchSpots = await getSpotsFromSupabase(selectedGroup);
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

async function setupGroupUi() {
  const groups = await getGroupsFromSupabase();
  await rebuildGroupSelect();

  const fromUrl = getInitialGroupFromUrl();
  const initial =
    fromUrl && groups.includes(fromUrl)
      ? fromUrl
      : groups[0] || DEFAULT_GROUP_NAME;
  await setSelectedGroup(initial, { updateUrl: true });

  // Keep group list in Supabase if table exists
  await ensureGroupExists(initial);

  if (groupSelect) {
    groupSelect.addEventListener('change', async () => {
      const next = normalizeGroupName(groupSelect.value);
      if (!next) return;
      await setSelectedGroup(next, { updateUrl: true });
      await ensureGroupExists(next);
      await applyGroupContext();
    });
  }

  if (createGroupBtn && newGroupNameInput) {
    createGroupBtn.addEventListener('click', async () => {
      const name = normalizeGroupName(newGroupNameInput.value);
      if (!name) return;

      await ensureGroupExists(name);
      await rebuildGroupSelect();
      if (groupSelect) groupSelect.value = name;
      newGroupNameInput.value = '';
      await setSelectedGroup(name, { updateUrl: true });
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

      addSpotToSupabase(selectedGroup, { name, location }).then(
        applyGroupContext,
      );

      newSpotNameInput.value = '';
      newSpotLocationInput.value = '';
    });

    newSpotNameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addSpotBtn.click();
    });
  }

  if (resetSpotsBtn) {
    resetSpotsBtn.addEventListener('click', () => {
      replaceGroupSpotsInSupabase(selectedGroup, [])
        .then(applyGroupContext)
        .catch((err) => console.error('Failed to reset spots:', err));
    });
  }
}

// Initialize app
async function init() {
  // Size & build the wheel dynamically
  if (!supabaseClient) {
    console.error('Supabase client not available; cannot persist state.');
  }

  await setupGroupUi();

  // Attach click handler immediately
  spinBtn.addEventListener('click', handleSpin);
  setupDragGesture();

  await applyGroupContext();
}

init();
