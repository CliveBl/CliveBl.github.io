import { getAssetFromKV } from '@cloudflare/kv-asset-handler'

/**
 * The DEBUG flag will do two things that help during development:
 * 1. we will skip caching on the edge, which makes it easier to
 *    debug.
 * 2. we will return an error message on exception in your Response rather
 *    than the default 404.html page.
 */
const DEBUG = false

addEventListener('fetch', event => {
  try {
    event.respondWith(handleEvent(event))
  } catch (e) {
    if (DEBUG) {
      return event.respondWith(
        new Response(e.message || e.toString(), {
          status: 500,
        }),
      )
    }
    event.respondWith(new Response('Internal Error', { status: 500 }))
  }
})

async function handleEvent(event) {
  const url = new URL(event.request.url)
  let options = {}

  // Handle POST requests to share-handler.html
  if (event.request.method === 'POST' && url.pathname === '/share-handler.html') {
    console.log('Cloudflare Worker: Redirecting POST request from share-handler.html to index.html')
    
    // Redirect to index.html
    return new Response(null, {
      status: 302,
      headers: {
        'Location': '/index.html'
      }
    })
  }

  /**
   * You can add custom logic to how we fetch your assets
   * by configuring the function `mapRequestToAsset`
   */
  // options.mapRequestToAsset = req => {
  //   // First check if the request is for a static asset
  //   if (req.url.includes('/assets/')) {
  //     // Custom cache control for assets
  //     return new Request(`${url.origin}/assets/${req.url.split('/').pop()}`, req)
  //   }
  //   // If not, return the original request
  //   return req
  // }

  try {
    if (DEBUG) {
      // customize caching
      options.cacheControl = {
        bypassCache: true,
      }
    }
    return await getAssetFromKV(event, options)
  } catch (e) {
    // if an error is thrown try to serve the asset at the root path
    if (!DEBUG) {
      try {
        let notFoundResponse = await getAssetFromKV(event, {
          mapRequestToAsset: req => new Request(`${new URL(req.url).origin}/404.html`, req),
        })

        return new Response(notFoundResponse.body, { ...notFoundResponse, status: 404 })
      } catch (e) {}
    }

    return new Response('Not Found', { status: 404 })
  }
}
