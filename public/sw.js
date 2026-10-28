const CACHE_VERSION = '__CACHE_VERSION__'.startsWith('__') ? 'dev-v1' : '__CACHE_VERSION__';
const CACHE_NAME = `ptmf2-cache-${CACHE_VERSION}`;

const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        ASSETS.map((asset) =>
          cache.add(asset).catch((err) => {
            console.warn('[Service Worker] Non-critical pre-cache error:', asset, err);
          })
        )
      );
    })
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Deleting outdated cache:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Ignore non-GET requests and external APIs
  if (e.request.method !== 'GET') {
    return;
  }

  const isNavigation = e.request.mode === 'navigate' || 
                       (e.request.headers.get('accept') && e.request.headers.get('accept').includes('text/html')) ||
                       url.pathname === '/' ||
                       url.pathname === '/index.html';

  if (isNavigation) {
    // Network-First Strategy for navigation (index.html)
    e.respondWith(
      fetch(e.request)
        .then((response) => {
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(e.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Offline fallback
          return caches.match(e.request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            return caches.match('/');
          });
        })
    );
    return;
  }

  // Files that should never be cached permanently
  const isExcluded = url.pathname.endsWith('sw.js') || 
                     url.pathname.endsWith('service-worker.js') || 
                     url.pathname.endsWith('manifest.json') ||
                     url.pathname.endsWith('manifest.webmanifest');

  if (isExcluded) {
    e.respondWith(fetch(e.request));
    return;
  }

  const isLocalAsset = url.origin === self.location.origin;
  if (isLocalAsset) {
    // Stale-While-Revalidate for local assets (JS, CSS, images, etc.)
    e.respondWith(
      caches.match(e.request).then((cachedResponse) => {
        if (cachedResponse) {
          // Fetch from network in background to update cache
          fetch(e.request).then((response) => {
            if (response.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(e.request, response);
              });
            }
          }).catch(() => {});
          
          return cachedResponse;
        }

        return fetch(e.request).then((response) => {
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(e.request, responseClone);
            });
          }
          return response;
        });
      })
    );
  } else {
    // Stale-While-Revalidate for images and external assets (Google Fonts, Firebase Storage, Unsplash, etc.)
    const isExternalStatic = url.href.includes('githubusercontent') || 
                             url.href.includes('googleapis') || 
                             url.href.includes('gstatic') ||
                             url.href.includes('images.unsplash.com');

    const isImageRequest = e.request.destination === 'image' || 
                           /\.(png|jpe?g|webp|gif|svg|ico)(\?.*)?$/i.test(url.pathname) ||
                           url.href.includes('firebasestorage.googleapis.com');

    if (isExternalStatic || isImageRequest) {
      e.respondWith(
        caches.match(e.request).then((cachedResponse) => {
          // Fetch latest version from network in the background to revalidate
          const networkFetch = fetch(e.request)
            .then((networkResponse) => {
              if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
                const responseClone = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(e.request, responseClone);
                });
              }
              return networkResponse;
            })
            .catch(() => null);

          // Return cached version immediately if available (stale-while-revalidate for instant smooth UX)
          if (cachedResponse) {
            return cachedResponse;
          }

          // Otherwise await network fetch
          return networkFetch.then((res) => {
            if (res) return res;
            return new Response('', { status: 408, statusText: 'Request Timed Out' });
          });
        })
      );
    }
  }
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  
  // Extract custom target URL from notification data
  let targetUrl = '/';
  if (e.notification.data) {
    if (e.notification.data.url) {
      targetUrl = e.notification.data.url;
    } else if (e.notification.data.relatedId) {
      targetUrl = `/pengumuman/${e.notification.data.relatedId}`;
    }
  }

  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          if (client.navigate && client.url) {
            try {
              client.navigate(targetUrl);
            } catch (err) {
              console.error('[Service Worker] Failed to navigate client:', err);
            }
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

self.addEventListener('push', (e) => {
  console.log('[Service Worker] Push event received.');
  
  let data = {
    title: 'PTMF2 App',
    body: 'Ada pemberitahuan baharu dari Persatuan Penduduk!'
  };

  if (e.data) {
    try {
      data = e.data.json();
    } catch (err) {
      data = {
        title: 'PTMF2 App',
        body: e.data.text()
      };
    }
  }

  const title = data.title || 'PTMF2 App';
  const options = {
    body: data.body || 'Ada pemberitahuan baharu!',
    icon: data.icon || '/icon.png',
    badge: data.badge || '/icon.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || (data.data && data.data.url) || '/',
      relatedId: data.announcementId || (data.data && data.data.relatedId) || null,
      ...data.data
    },
    tag: data.announcementId ? `announcement-${data.announcementId}` : 'ptmf2-notification',
    renotify: true
  };

  e.waitUntil(
    self.registration.showNotification(title, options)
  );
});
