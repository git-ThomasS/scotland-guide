/* compass.js — shared utilities */

/* ── Sunlight mode ── */
(function() {
  if (localStorage.getItem('sunlight') === '1') {
    document.body.classList.add('sunlight');
  }
})();

function toggleSunlight() {
  const on = document.body.classList.toggle('sunlight');
  localStorage.setItem('sunlight', on ? '1' : '0');
}

/* ── Toast ── */
function showToast(msg, duration = 3000) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), duration);
}

/* ── Geo + compass state ── */
const GEO = {
  lat: null,
  lng: null,
  accuracy: null,
  heading: 0,
  watching: false,
  orientationActive: false,
  callbacks: [],

  onUpdate(fn) { this.callbacks.push(fn); },
  _notify() { this.callbacks.forEach(fn => fn()); },
};

/* ── Request location (iOS-safe) ── */
async function requestLocationAndCompass() {
  // 1. Geolocation
  if (!navigator.geolocation) {
    showToast('GPS not available on this device');
    return false;
  }

  const geoPromise = new Promise((resolve, reject) => {
    navigator.geolocation.watchPosition(
      pos => {
        GEO.lat = pos.coords.latitude;
        GEO.lng = pos.coords.longitude;
        GEO.accuracy = pos.coords.accuracy;
        GEO.watching = true;
        GEO._notify();
        resolve(true);
      },
      err => {
        const msgs = {
          1: 'Location permission denied — enable in Settings > Safari > Location',
          2: 'Location unavailable',
          3: 'Location request timed out',
        };
        showToast(msgs[err.code] || 'Location error');
        reject(err);
      },
      { enableHighAccuracy: true, maximumAge: 4000, timeout: 12000 }
    );
  });

  // 2. Compass — iOS 13+ needs explicit permission from a user gesture
  async function startOrientation() {
    if (typeof DeviceOrientationEvent === 'undefined') {
      showToast('Compass not supported on this browser');
      return;
    }
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const perm = await DeviceOrientationEvent.requestPermission();
        if (perm !== 'granted') {
          showToast('Compass permission denied — compass will use GPS bearing');
          return;
        }
      } catch (e) {
        showToast('Could not request compass permission');
        return;
      }
    }
    window.addEventListener('deviceorientation', _onOrientation, true);
    GEO.orientationActive = true;
  }

  try {
    await geoPromise;
    await startOrientation();
    return true;
  } catch (e) {
    return false;
  }
}

function _onOrientation(e) {
  let h = null;
  if (e.webkitCompassHeading != null) {
    h = e.webkitCompassHeading; // iOS — already magnetic north, 0-360
  } else if (e.alpha != null) {
    h = (360 - e.alpha) % 360; // Android fallback
  }
  if (h == null) return;
  GEO.heading = h;
  GEO._notify();
}

/* ── Maths ── */
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 +
    Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function getBearing(lat1, lng1, lat2, lng2) {
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const y = Math.sin(dLng) * Math.cos(lat2 * Math.PI / 180);
  const x = Math.cos(lat1*Math.PI/180) * Math.sin(lat2*Math.PI/180) -
            Math.sin(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.cos(dLng);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function formatDist(m) {
  if (m < 100) return `${Math.round(m)}m`;
  if (m < 1000) return `${Math.round(m / 10) * 10}m`;
  return `${(m / 1000).toFixed(1)}km`;
}

// Relative bearing from current heading to target
function relativeBearing(targetAbsoluteBearing) {
  return ((targetAbsoluteBearing - GEO.heading) + 360) % 360;
}

// Hide the GPS button immediately — we request silently on load.
// Only show it again if something actually fails.
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('locate-btn');
  if (btn) btn.style.display = 'none';

  requestLocationAndCompass().catch(() => {
    // On failure, show the button so the user can retry manually
    if (btn) btn.style.display = '';
  });
});

// iOS requires DeviceOrientation permission from a user gesture.
// Use touchend with once:true — fires exactly once on first tap,
// never interferes with link navigation afterwards.
document.addEventListener('touchend', function() {
  if (!GEO.orientationActive) requestLocationAndCompass();
}, { passive: true, once: true });