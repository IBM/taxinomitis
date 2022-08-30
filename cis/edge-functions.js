addEventListener('fetch', event => {
  event.respondWith(handle(event.request));
});


async function handle(request) {
  let url = new URL(request.url)
  if (url.hostname === 'scratch.machinelearningforkids.co.uk') {
      return handleRequest(request, [
          'mlforkids-scratch.j8ayd8ayn23.eu-de.codeengine.appdomain.cloud',
          'mlforkids-scratch.j8clybxvjr0.us-south.codeengine.appdomain.cloud',
          'mlforkids-scratch.j8ahcaxwtd1.au-syd.codeengine.appdomain.cloud'
      ]);
  } else if (url.hostname === 'proxy.machinelearningforkids.co.uk') {
      return handleRequest(request, [
          'mlforkids-proxy.j8ayd8ayn23.eu-de.codeengine.appdomain.cloud',
          'mlforkids-proxy.j8clybxvjr0.us-south.codeengine.appdomain.cloud',
          'mlforkids-proxy.j8ahcaxwtd1.au-syd.codeengine.appdomain.cloud'
      ]);
  } else {
      return fetch(request)
  }
}


async function handleRequest(request, targetHostCandidates) {
  let response = null;
  for (const targetHost of targetHostCandidates) {
      response = await forwardRequest(request, targetHost);

      if (response.ok || response.redirected) {
          // successful request - return the response
          return response;
      }
  }
  // request failed for all target hosts - return the last attempt
  return response;
}


function forwardRequest(request, targetHost) {
  const newUrl = new URL(request.url);
  const newRequest = new Request(request);

  newRequest.headers.set('X-Forwarded-Host', request.url.hostname);
  newRequest.headers.set('host', targetHost);

  newUrl.hostname = targetHost;
  newUrl.protocol = 'https:';

  return fetch(newUrl, newRequest);
}
