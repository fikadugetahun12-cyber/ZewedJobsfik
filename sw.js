// Service Worker Version
const CACHE_VERSION = 'v2.0.0';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `dynamic-${CACHE_VERSION}`;

// Essential files to cache on install
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/assets/css/style.min.css',
    '/assets/js/main.min.js',
    '/assets/images/logo-192.png',
    '/assets/images/logo-512.png',
    '/assets/images/favicon.ico',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Montserrat:wght@700;800;900&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// Install event - cache static assets
self.addEventListener('install', event => {
    console.log('[Service Worker] Installing...', CACHE_VERSION);
    
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(cache => {
                console.log('[Service Worker] Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('[Service Worker] Install completed');
                return self.skipWaiting();
            })
            .catch(error => {
                console.error('[Service Worker] Installation failed:', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    console.log('[Service Worker] Activating...');
    
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    // Delete old caches that don't match current version
                    if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
                        console.log('[Service Worker] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
        .then(() => {
            console.log('[Service Worker] Activation completed');
            return self.clients.claim();
        })
    );
});

// Fetch event - network-first strategy
self.addEventListener('fetch', event => {
    // Skip non-GET requests and chrome-extension requests
    if (event.request.method !== 'GET' || event.request.url.startsWith('chrome-extension')) {
        return;
    }
    
    event.respondWith(
        // Try network first
        fetch(event.request)
            .then(networkResponse => {
                // Cache successful network responses
                if (event.request.url.startsWith('http')) {
                    caches.open(DYNAMIC_CACHE)
                        .then(cache => {
                            cache.put(event.request, networkResponse.clone());
                        });
                }
                return networkResponse;
            })
            .catch(() => {
                // Network failed, try cache
                return caches.match(event.request)
                    .then(cachedResponse => {
                        if (cachedResponse) {
                            return cachedResponse;
                        }
                        
                        // Return offline page for HTML requests
                        if (event.request.headers.get('accept').includes('text/html')) {
                            return caches.match('/offline.html')
                                .then(offlineResponse => offlineResponse);
                        }
                        
                        // Return placeholder for images
                        if (event.request.headers.get('accept').includes('image')) {
                            return caches.match('/assets/images/placeholder.png');
                        }
                    });
            })
    );
});

// Background sync for offline data
self.addEventListener('sync', event => {
    if (event.tag === 'sync-jobs') {
        console.log('[Service Worker] Background sync: syncing jobs');
        event.waitUntil(syncJobs());
    }
});

// Push notifications
self.addEventListener('push', event => {
    console.log('[Service Worker] Push received');
    
    const data = event.data ? event.data.json() : {};
    const title = data.title || 'ZewedJobs';
    const options = {
        body: data.body || 'New job alert!',
        icon: '/assets/images/logo-192.png',
        badge: '/assets/images/badge.png',
        vibrate: [200, 100, 200],
        data: {
            url: data.url || '/'
        },
        actions: [
            {
                action: 'view',
                title: 'View Job'
            },
            {
                action: 'dismiss',
                title: 'Dismiss'
            }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

// Notification click handler
self.addEventListener('notificationclick', event => {
    console.log('[Service Worker] Notification clicked');
    
    event.notification.close();
    
    if (event.action === 'view') {
        event.waitUntil(
            clients.openWindow(event.notification.data.url)
        );
    } else if (event.action === 'dismiss') {
        // Do nothing
    } else {
        // Default action - open app
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});

// Periodic background sync
self.addEventListener('periodicsync', event => {
    if (event.tag === 'update-jobs') {
        console.log('[Service Worker] Periodic sync: updating jobs');
        event.waitUntil(updateJobListings());
    }
});

// Helper functions
async function syncJobs() {
    // Implement job synchronization logic
    console.log('Syncing jobs...');
}

async function updateJobListings() {
    // Implement job listing updates
    console.log('Updating job listings...');
}

// Keep service worker alive
self.addEventListener('message', event => {
    if (event.data && event.data.type === 'KEEP_ALIVE') {
        console.log('[Service Worker] Keep alive received');
    }
});
