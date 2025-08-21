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
    console.log('Cloudflare Worker: Handling POST request to share-handler.html')
    
    try {
      // Get the form data from the POST request
      const formData = await event.request.formData()
      const files = formData.getAll('documents')
      
      console.log(`Cloudflare Worker: Received ${files.length} shared files`)
      
             // Convert files to base64 and pass them to the browser
       const fileData = []
       for (let i = 0; i < files.length; i++) {
         const file = files[i]
         const arrayBuffer = await file.arrayBuffer()
         const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
         
         fileData.push({
           name: file.name,
           type: file.type,
           size: file.size,
           lastModified: file.lastModified,
           data: `data:${file.type};base64,${base64}`
         })
       }
       
       // Return the share-handler.html page with file data embedded
       const response = await getAssetFromKV(event, options)
       const html = await response.text()
       
       // Add script with file data so the page can access it immediately
       const modifiedHtml = html.replace(
         '</body>',
         `<script>
           console.log('Cloudflare Worker: Files received via POST');
           console.log('File count:', ${files.length});
           
           // Make files available to the page
           window.sharedFilesFromWorker = ${JSON.stringify(fileData)};
           console.log('Files made available to page:', window.sharedFilesFromWorker);
         </script>
         </body>`
       )
      
      return new Response(modifiedHtml, {
        headers: {
          'Content-Type': 'text/html',
          'X-Files-Count': files.length.toString(),
          'X-Share-Request': 'true'
        }
      })
      
    } catch (error) {
      console.error('Cloudflare Worker: Error processing POST request:', error)
      return new Response('Error processing shared files', { status: 500 })
    }
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
