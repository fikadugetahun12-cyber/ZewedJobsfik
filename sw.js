// Service Worker for ZewedJobs - Ethiopia's #1 Job Platform
// Version: 2.0.0

// ================= CONFIGURATION =================
const APP_VERSION = '2.0.0';
const CACHE_NAME = `zewedjobs-${APP_VERSION}`;
const OFFLINE_URL = '/offline.html';
const API_CACHE_NAME = 'zewedjobs-api-cache';

// ================= CACHE STRATEGIES =================
const CACHE_CONFIG = {
  // Static assets that rarely change
  STATIC: {
    name: CACHE_NAME,
    urls: [
      '/',
      '/index.html',
      '/manifest.json',
      '/offline.html',
      '/assets/css/style.min.css',
      '/assets/js/main.min.js',
      // Core fonts
      'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Montserrat:wght@700;800;900&display=swap',
      'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
      // Core images
      '/assets/images/logo-192.png',
      '/assets/images/logo-512.png',
      '/assets/images/favicon.ico',
      '/assets/images/placeholder-job.png'
    ]
  },
  
  // API responses that can be cached
  API: {
    name: API_CACHE_NAME,
    maxAge: 3600, // 1 hour in seconds
    urls: [
      '/api/jobs/recent',
      '/api/categories',
      '/api/trending'
    ]
  }
};

// ================= SERVICE WORKER EVENTS =================

// Install Event - Cache static assets
self.addEventListener('install', event => {
  console.log('[SW] Installing service worker version:', APP_VERSION);
  
  event.waitUntil(
    Promise.all([
      // Cache static assets
      caches.open(CACHE_CONFIG.STATIC.name)
        .then(cache => {
          console.log('[SW] Caching static assets');
          return cache.addAll(CACHE_CONFIG.STATIC.urls);
        }),
      
      // Skip waiting to activate immediately
      self.skipWaiting()
    ])
    .then(() => {
      console.log('[SW] Install completed');
    })
    .catch(error => {
      console.error('[SW] Installation failed:', error);
    })
  );
});

// Activate Event - Clean up old caches
self.addEventListener('activate', event => {
  console.log('[SW] Activating service worker');
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            // Delete caches that aren't current
            if (!Object.values(CACHE_CONFIG).some(config => 
                config.name === cacheName)) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      
      // Claim clients immediately
      self.clients.claim()
    ])
    .then(() => {
      console.log('[SW] Activation completed');
      
      // Send version info to all clients
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({
            type: 'SW_VERSION',
            version: APP_VERSION,
            status: 'activated'
          });
        });
      });
    })
  );
});

// ================= FETCH EVENT HANDLER =================
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests and chrome-extension
  if (request.method !== 'GET' || 
      request.url.startsWith('chrome-extension://') ||
      request.url.includes('sockjs-node')) {
    return;
  }
  
  // Handle different strategies based on URL
  if (url.origin === self.location.origin) {
    // Same-origin requests
    if (url.pathname.startsWith('/api/')) {
      // API requests - Network First with Cache Fallback
      event.respondWith(handleApiRequest(event));
    } else if (url.pathname.match(/\.(css|js|woff2?)$/)) {
      // CSS/JS/Fonts - Cache First
      event.respondWith(handleStaticAssets(event));
    } else if (url.pathname.match(/\.(png|jpg|jpeg|gif|svg|ico)$/)) {
      // Images - Cache First with placeholder fallback
      event.respondWith(handleImageRequest(event));
    } else {
      // HTML pages - Network First with Offline Fallback
      event.respondWith(handleHtmlRequest(event));
    }
  } else {
    // Cross-origin requests (CDNs, fonts, etc.)
    if (url.hostname.includes('googleapis.com') || 
        url.hostname.includes('cdnjs.cloudflare.com')) {
      // CDN resources - Cache First
      event.respondWith(handleCdnRequest(event));
    } else {
      // Other external resources - Network Only
      event.respondWith(fetch(request));
    }
  }
});

// ================= FETCH STRATEGIES =================

// Handle API requests (Network First)
async function handleApiRequest(event) {
  const cache = await caches.open(CACHE_CONFIG.API.name);
  const { request } = event;
  
  try {
    // Try network first
    const networkResponse = await fetch(request);
    
    // Clone response for caching
    const responseToCache = networkResponse.clone();
    
    // Cache successful responses
    if (networkResponse.status === 200) {
      cache.put(request, responseToCache).catch(() => {
        // Ignore cache errors
      });
      
      // Set cache expiration
      const headers = new Headers(networkResponse.headers);
      headers.set('sw-cached', 'false');
      headers.set('sw-cache-expires', 
        Date.now() + (CACHE_CONFIG.API.maxAge * 1000));
      
      return new Response(networkResponse.body, {
        status: networkResponse.status,
        statusText: networkResponse.statusText,
        headers
      });
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, trying cache for:', request.url);
    
    // Network failed, try cache
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      const headers = new Headers(cachedResponse.headers);
      headers.set('sw-cached', 'true');
      
      return new Response(cachedResponse.body, {
        status: cachedResponse.status,
        statusText: cachedResponse.statusText,
        headers
      });
    }
    
    // No cache, return error
    return new Response(
      JSON.stringify({ 
        error: 'Network unavailable',
        message: 'Please check your internet connection'
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Handle static assets (Cache First)
async function handleStaticAssets(event) {
  const cache = await caches.open(CACHE_CONFIG.STATIC.name);
  const cachedResponse = await cache.match(event.request);
  
  if (cachedResponse) {
    // Update cache in background
    event.waitUntil(
      fetch(event.request).then(response => {
        cache.put(event.request, response);
      }).catch(() => {
        // Ignore update errors
      })
    );
    
    const headers = new Headers(cachedResponse.headers);
    headers.set('sw-cached', 'true');
    
    return new Response(cachedResponse.body, {
      status: cachedResponse.status,
      statusText: cachedResponse.statusText,
      headers
    });
  }
  
  // Not in cache, fetch from network
  return fetch(event.request);
}

// Handle HTML requests (Network First)
async function handleHtmlRequest(event) {
  try {
    // Try network first
    const networkResponse = await fetch(event.request);
    
    // Update cache in background
    event.waitUntil(
      caches.open(CACHE_CONFIG.STATIC.name).then(cache => {
        cache.put(event.request, networkResponse.clone());
      })
    );
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, serving offline page');
    
    // Check for cached response
    const cache = await caches.open(CACHE_CONFIG.STATIC.name);
    const cachedResponse = await cache.match(event.request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Serve offline page
    const offlineResponse = await cache.match(OFFLINE_URL);
    return offlineResponse || new Response('Offline', { status: 503 });
  }
}

// Handle image requests
async function handleImageRequest(event) {
  const cache = await caches.open(CACHE_CONFIG.STATIC.name);
  const cachedResponse = await cache.match(event.request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(event.request);
    
    // Cache successful image responses
    if (networkResponse.status === 200) {
      cache.put(event.request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Return placeholder image
    return cache.match('/assets/images/placeholder-job.png');
  }
}

// Handle CDN requests
async function handleCdnRequest(event) {
  const cache = await caches.open(CACHE_CONFIG.STATIC.name);
  const cachedResponse = await cache.match(event.request);
  
  if (cachedResponse) {
    // Update in background
    event.waitUntil(
      fetch(event.request)
        .then(response => cache.put(event.request, response))
        .catch(() => {})
    );
    return cachedResponse;
  }
  
  const networkResponse = await fetch(event.request);
  cache.put(event.request, networkResponse.clone());
  return networkResponse;
}

// ================= BACKGROUND SYNC =================
self.addEventListener('sync', event => {
  console.log('[SW] Background sync:', event.tag);
  
  switch (event.tag) {
    case 'sync-job-applications':
      event.waitUntil(syncJobApplications());
      break;
      
    case 'sync-favorites':
      event.waitUntil(syncFavoriteJobs());
      break;
      
    case 'update-job-listings':
      event.waitUntil(updateJobListings());
      break;
      
    default:
      console.log('[SW] Unknown sync tag:', event.tag);
  }
});

// ================= PUSH NOTIFICATIONS =================
self.addEventListener('push', event => {
  console.log('[SW] Push notification received');
  
  if (!event.data) return;
  
  const data = event.data.json();
  const title = data.title || 'ZewedJobs';
  const options = {
    body: data.body || 'New job alert!',
    icon: '/assets/images/logo-192.png',
    badge: '/assets/images/badge-72.png',
    image: data.image || '/assets/images/notification-bg.png',
    data: {
      url: data.url || '/',
      jobId: data.jobId,
      timestamp: Date.now()
    },
    actions: [
      {
        action: 'view-job',
        title: 'View Job',
        icon: '/assets/images/action-view.png'
      },
      {
        action: 'save-job',
        title: 'Save',
        icon: '/assets/images/action-save.png'
      }
    ],
    vibrate: [200, 100, 200, 100, 200],
    requireInteraction: data.important || false,
    tag: data.tag || 'job-alert',
    renotify: true,
    silent: false,
    timestamp: Date.now()
  };
  
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ================= NOTIFICATION CLICK HANDLER =================
self.addEventListener('notificationclick', event => {
  console.log('[SW] Notification clicked:', event.action);
  
  event.notification.close();
  
  const { notification } = event;
  const data = notification.data || {};
  
  // Handle action buttons
  switch (event.action) {
    case 'view-job':
      if (data.jobId) {
        event.waitUntil(
          clients.openWindow(`/job/${data.jobId}`)
        );
      } else if (data.url) {
        event.waitUntil(
          clients.openWindow(data.url)
        );
      }
      break;
      
    case 'save-job':
      // Save job to favorites
      event.waitUntil(
        saveJobToFavorites(data.jobId).then(() => {
          // Show confirmation
          self.registration.showNotification('Job Saved!', {
            body: 'Job has been saved to your favorites',
            icon: '/assets/images/logo-192.png',
            badge: '/assets/images/badge-72.png'
          });
        })
      );
      break;
      
    default:
      // Default action - open app
      event.waitUntil(
        clients.matchAll({
          type: 'window',
          includeUncontrolled: true
        }).then(windowClients => {
          // Check if window is already open
          for (const client of windowClients) {
            if (client.url === '/' && 'focus' in client) {
              return client.focus();
            }
          }
          
          // Open new window
          if (clients.openWindow) {
            return clients.openWindow(data.url || '/');
          }
        })
      );
  }
});

// ================= PERIODIC BACKGROUND SYNC =================
self.addEventListener('periodicsync', event => {
  console.log('[SW] Periodic background sync:', event.tag);
  
  if (event.tag === 'update-jobs-daily') {
    event.waitUntil(updateJobsDaily());
  } else if (event.tag === 'cleanup-cache') {
    event.waitUntil(cleanupOldCache());
  }
});

// ================= MESSAGE HANDLER =================
self.addEventListener('message', event => {
  console.log('[SW] Message received:', event.data);
  
  switch (event.data.type) {
    case 'GET_VERSION':
      event.ports[0].postMessage({
        type: 'VERSION_INFO',
        version: APP_VERSION,
        cacheStatus: 'active'
      });
      break;
      
    case 'CLEAR_CACHE':
      clearSpecificCache(event.data.cacheName).then(() => {
        event.ports[0].postMessage({
          type: 'CACHE_CLEARED',
          cacheName: event.data.cacheName
        });
      });
      break;
      
    case 'UPDATE_CACHE':
      updateStaticCache().then(() => {
        event.ports[0].postMessage({
          type: 'CACHE_UPDATED'
        });
      });
      break;
      
    case 'GET_CACHE_STATUS':
      getCacheStatus().then(status => {
        event.ports[0].postMessage({
          type: 'CACHE_STATUS',
          status
        });
      });
      break;
      
    case 'KEEP_ALIVE':
      // Just acknowledge
      if (event.ports[0]) {
        event.ports[0].postMessage({ type: 'ALIVE' });
      }
      break;
  }
});

// ================= HELPER FUNCTIONS =================

// Sync job applications
async function syncJobApplications() {
  const db = await openJobApplicationsDB();
  const pendingApplications = await db.getAll('applications', 'pending');
  
  for (const app of pendingApplications) {
    try {
      const response = await fetch('/api/applications/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(app)
      });
      
      if (response.ok) {
        // Mark as synced
        app.status = 'submitted';
        await db.put('applications', app);
        
        console.log('[SW] Application synced:', app.jobId);
      }
    } catch (error) {
      console.error('[SW] Failed to sync application:', error);
    }
  }
}

// Sync favorite jobs
async function syncFavoriteJobs() {
  // Implementation for syncing favorite jobs
  console.log('[SW] Syncing favorite jobs...');
}

// Update job listings
async function updateJobListings() {
  try {
    const response = await fetch('/api/jobs/updated?since=' + 
      (Date.now() - 24 * 60 * 60 * 1000));
    const jobs = await response.json();
    
    if (jobs.length > 0) {
      // Update cache
      const cache = await caches.open(CACHE_CONFIG.API.name);
      await cache.put(
        new Request('/api/jobs/recent'),
        new Response(JSON.stringify(jobs))
      );
      
      // Show notification for new jobs
      if (jobs.length > 0) {
        self.registration.showNotification(`📢 ${jobs.length} New Jobs`, {
          body: 'Check out the latest job opportunities',
          icon: '/assets/images/logo-192.png',
          tag: 'new-jobs',
          data: { url: '/jobs/new' }
        });
      }
    }
  } catch (error) {
    console.error('[SW] Failed to update job listings:', error);
  }
}

// Save job to favorites
async function saveJobToFavorites(jobId) {
  // Implementation for saving job to IndexedDB
  console.log('[SW] Saving job to favorites:', jobId);
}

// Open IndexedDB for job applications
function openJobApplicationsDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ZewedJobsApplications', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      if (!db.objectStoreNames.contains('applications')) {
        const store = db.createObjectStore('applications', { 
          keyPath: 'id',
          autoIncrement: true 
        });
        store.createIndex('status', 'status');
        store.createIndex('jobId', 'jobId');
      }
    };
  });
}

// Update static cache
async function updateStaticCache() {
  const cache = await caches.open(CACHE_CONFIG.STATIC.name);
  await cache.addAll(CACHE_CONFIG.STATIC.urls);
}

// Clear specific cache
async function clearSpecificCache(cacheName) {
  return caches.delete(cacheName);
}

// Get cache status
async function getCacheStatus() {
  const cacheNames = await caches.keys();
  const status = {};
  
  for (const name of cacheNames) {
    const cache = await caches.open(name);
    const requests = await cache.keys();
    status[name] = {
      size: requests.length,
      urls: requests.map(req => req.url)
    };
  }
  
  return status;
}

// Clean up old cache entries
async function cleanupOldCache() {
  const cache = await caches.open(CACHE_CONFIG.API.name);
  const requests = await cache.keys();
  
  const now = Date.now();
  for (const request of requests) {
    const response = await cache.match(request);
    if (response) {
      const expires = response.headers.get('sw-cache-expires');
      if (expires && parseInt(expires) < now) {
        await cache.delete(request);
      }
    }
  }
}

// Daily job updates
async function updateJobsDaily() {
  console.log('[SW] Running daily job update...');
  await updateJobListings();
}

// ================= OFFLINE DETECTION =================
function broadcastOnlineStatus(isOnline) {
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: 'NETWORK_STATUS',
        isOnline
      });
    });
  });
}

// Listen to network status changes
self.addEventListener('online', () => {
  console.log('[SW] Device is online');
  broadcastOnlineStatus(true);
});

self.addEventListener('offline', () => {
  console.log('[SW] Device is offline');
  broadcastOnlineStatus(false);
});

// ================= ERROR HANDLING =================
self.addEventListener('error', error => {
  console.error('[SW] Error:', error);
});

self.addEventListener('unhandledrejection', event => {
  console.error('[SW] Unhandled rejection:', event.reason);
});

// ================= INITIALIZATION =================
console.log('[SW] Service Worker loaded version:', APP_VERSION);
console.log('[SW] Cache configuration:', CACHE_CONFIG);

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CACHE_CONFIG,
    handleApiRequest,
    handleStaticAssets,
    handleHtmlRequest
  };
}
