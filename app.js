// ============================================
// CONFIGURATION - Update these values
// ============================================

const SUPABASE_URL = 'https://pyplwpohrszraafvfobf.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5cGx3cG9ocnN6cmFhZnZmb2JmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU3MTE2NjksImV4cCI6MjA3MTI4NzY2OX0.VKZ8OZj2uuFgpnpeBCld_zijeCZw3OQE-ERUrflBrt0';

// Campus lunch spots from Pocket Guide 2025
// Each spot has a name and location
const LUNCH_SPOTS = [
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

let currentRotation = 0;
let todaysPick = null;
let yesterdaysPick = null;

// Get today's date as YYYY-MM-DD
const getToday = () => new Date().toISOString().split('T')[0];

// Build the wheel segments
function buildWheel() {
  const numSegments = LUNCH_SPOTS.length;
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
    const spot = LUNCH_SPOTS[i];
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
  if (!yesterdaysPick) return LUNCH_SPOTS;
  return LUNCH_SPOTS.filter((spot) => spot.name !== yesterdaysPick);
}

// Spin the wheel to a specific spot
function spinToSpot(spot) {
  const spotIndex = LUNCH_SPOTS.findIndex((s) => s.name === spot.name);
  const segmentAngle = 360 / LUNCH_SPOTS.length;

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

// Load history from Supabase
async function loadHistory() {
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

// Save pick to Supabase
async function savePick(spot) {
  const { error } = await supabaseClient
    .from('lunch_picks')
    .insert({ pick_date: getToday(), spot_name: spot });

  if (error) {
    console.error('Error saving pick:', error);
    throw error;
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
            <span class="spot">${pick.spot_name}${pick.pick_date === today ? '<span class="today">TODAY</span>' : ''}</span>
            <span class="date">${formatDate(pick.pick_date)}</span>
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
    if (supabaseClient) {
      await savePick(picked.name);
      const history = await loadHistory();
      renderHistory(history);
    }
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

// Initialize app
async function init() {
  // Size & build the wheel dynamically
  sizeWheelToContainer();
  buildWheel();

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

  try {
    if (!supabaseClient) {
      console.log('Supabase not available, running in offline mode');
      return;
    }

    const history = await loadHistory();
    renderHistory(history);

    yesterdaysPick = getYesterdaysPick(history);

    const alreadySpun = await checkTodaysPick(history);
    if (alreadySpun) {
      disableWheel();
      wheel.style.cursor = 'not-allowed';
      // Show where the wheel landed
      const spotIndex = LUNCH_SPOTS.findIndex((s) => s.name === todaysPick);
      const segmentAngle = 360 / LUNCH_SPOTS.length;
      wheel.style.transition = 'none';
      wheel.style.transform = `rotate(${-(spotIndex * segmentAngle)}deg)`;
    }
  } catch (err) {
    console.error('Failed to initialize:', err);
  }
}

init();
