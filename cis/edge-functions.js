addEventListener('fetch', event => {
  event.respondWith(handle(event.request));
});


async function handle(request) {
  const url = new URL(request.url);
  if (url.hostname === 'machinelearningforkids.co.uk') {
    return handleGeoSteeredRequest(request, 'mlforkids-api.');
  } else if (url.hostname === 'scratch.machinelearningforkids.co.uk') {
    return handleGeoSteeredRequest(request, 'mlforkids-scratch.');
  } else if (url.hostname === 'proxy.machinelearningforkids.co.uk') {
    return handleGeoSteeredRequest(request, 'mlforkids-proxy.');
  } else {
    // should never get here - only triggers for the above
    //  three hostnames should be registered
    return fetch(request)
  }
}


// super-paranoid and hopefully fail-safe function for
//  getting the country code for the incoming request
function getCountryCode(request) {
  try {
    // get the country that the client is in, as identified by Cloudflare
    const hdr = request.headers.get('cf-ipcountry');
    if (hdr in COUNTRIES) {
      return hdr;
    }
  }
  catch (err) {
    // something unexpected went wrong
    //   I don't have access to logs for edge workers
    //   so no point in logging it
  }

  // default country code if we couldn't work out
  //  the right code to use
  return 'XX';
}


// super-paranoid and hopefully fail-safe function for
//  getting a list of origin sites, sorted in
//  order of preference (based on location of the
//  incoming request)
function getOrigins(request) {
  try {
    const countryCode = getCountryCode(request);
    const countryInfo = COUNTRIES[countryCode];
    const regionInfo = REGIONS[countryInfo.regionid];
    return regionInfo.origins;
  }
  catch (err) {
    // something went wrong - return an arbitrary list
    return [
      'j8ahcaxwtd1.au-syd.codeengine.appdomain.cloud',
      'j8ayd8ayn23.eu-de.codeengine.appdomain.cloud',
      'y2inoz01f4q.eu-de.codeengine.appdomain.cloud',
      'j8clybxvjr0.us-south.codeengine.appdomain.cloud'
    ];
  }
}


async function handleGeoSteeredRequest(request, routePrefix) {
  const targetOrigins = getOrigins(request);

  let response = null;
  for (const targetHost of targetOrigins) {
      response = await forwardRequest(request, routePrefix + targetHost);

      if (response.status < 500) {
          // request successfully handled by the target - return the response
          return response;
      }
  }
  // request failed for all target hosts - return the last attempt
  return response;
}


function forwardRequest(request, targetHost) {
  const newUrl = new URL(request.url);
  newUrl.hostname = targetHost;
  newUrl.protocol = 'https:';

  const newRequest = new Request(request);
  // newRequest.headers.set('X-Forwarded-Host', request.url.hostname);
  newRequest.headers.set('host', targetHost);

  if (isUrlExemptFromBrowserIntegrityCheck(request)) {
    // URLs for some Scratch APIs are commonly accessed by non-browser
    //  clients (Python/Tensorflow/AppInventor/etc) so for these we
    //  add a user-agent to pretend to be curl, so that the Cloudflare
    //  in-front of Code Engine is less likely to block them
    newRequest.headers.set('user-agent', 'curl/7.79.1');
  }

  return fetch(newUrl, newRequest);
}


function isUrlExemptFromBrowserIntegrityCheck(request) {
  try {
    return BIC_EXEMPT_URLS.some((urlRegexTest) => urlRegexTest.test(request.url));
  }
  catch (err) {
    // we couldn't check - let's assume it isn't
    return false;
  }
}

const BIC_EXEMPT_URLS = [
  /https:\/\/machinelearningforkids\.co\.uk\/api\/scratch\/[0-9a-f-]{72}\/train/,
  /https:\/\/machinelearningforkids\.co\.uk\/api\/scratch\/[0-9a-f-]{72}\/images\/api\/classes\/.*\/students\/.*\/projects\/.*\/images\/.*/,
  /https:\/\/machinelearningforkids\.co\.uk\/api\/appinventor\/[0-9a-f-]{72}\/extension/,
];


const COUNTRIES = {
  "AL": { "regionid": "EEU", "country": "Albania" },
  "AT": { "regionid": "EEU", "country": "Austria" },
  "BG": { "regionid": "EEU", "country": "Bulgaria" },
  "BY": { "regionid": "EEU", "country": "Belarus" },
  "CY": { "regionid": "EEU", "country": "Cyprus" },
  "CZ": { "regionid": "EEU", "country": "Czech Republic" },
  "DK": { "regionid": "EEU", "country": "Denmark" },
  "EE": { "regionid": "EEU", "country": "Estonia" },
  "FI": { "regionid": "EEU", "country": "Finland" },
  "GR": { "regionid": "EEU", "country": "Greece" },
  "HR": { "regionid": "EEU", "country": "Croatia" },
  "HU": { "regionid": "EEU", "country": "Hungary" },
  "LT": { "regionid": "EEU", "country": "Lithuania" },
  "LV": { "regionid": "EEU", "country": "Latvia" },
  "MD": { "regionid": "EEU", "country": "Moldova" },
  "NO": { "regionid": "EEU", "country": "Norway" },
  "PL": { "regionid": "EEU", "country": "Poland" },
  "RO": { "regionid": "EEU", "country": "Romania" },
  "RS": { "regionid": "EEU", "country": "Serbia" },
  "SE": { "regionid": "EEU", "country": "Sweden" },
  "SK": { "regionid": "EEU", "country": "Slovakia" },
  "TR": { "regionid": "EEU", "country": "Turkey" },
  "UA": { "regionid": "EEU", "country": "Ukraine" },

  "DO": { "regionid": "ENAM", "country": "Dominican Republic" },
  "HN": { "regionid": "ENAM", "country": "Honduras" },

  "AE": { "regionid": "ME", "country": "United Arab Emirates" },
  "AM": { "regionid": "ME", "country": "Armenia" },
  "AZ": { "regionid": "ME", "country": "Azerbaijan" },
  "BH": { "regionid": "ME", "country": "Bahrain" },
  "GE": { "regionid": "ME", "country": "Georgia" },
  "IL": { "regionid": "ME", "country": "Israel" },
  "IQ": { "regionid": "ME", "country": "Iraq" },
  "JO": { "regionid": "ME", "country": "Jordan" },
  "KW": { "regionid": "ME", "country": "Kuwait" },
  "LB": { "regionid": "ME", "country": "Lebanon" },
  "OM": { "regionid": "ME", "country": "Oman" },
  "PS": { "regionid": "ME", "country": "Palestine" },
  "QA": { "regionid": "ME", "country": "Qatar" },
  "SA": { "regionid": "ME", "country": "Saudi Arabia" },

  "BF": { "regionid": "NAF", "country": "Burkina Faso" },
  "DJ": { "regionid": "NAF", "country": "Djibouti" },
  "DZ": { "regionid": "NAF", "country": "Algeria" },
  "GH": { "regionid": "NAF", "country": "Ghana" },
  "LR": { "regionid": "NAF", "country": "Liberia" },
  "MA": { "regionid": "NAF", "country": "Morocco" },
  "NG": { "regionid": "NAF", "country": "Nigeria" },
  "SN": { "regionid": "NAF", "country": "Senegal" },
  "TN": { "regionid": "NAF", "country": "Tunisia" },

  "HK": { "regionid": "NEAS", "country": "Hong Kong" },
  "JP": { "regionid": "NEAS", "country": "Japan" },
  "KR": { "regionid": "NEAS", "country": "Korea, South" },
  "MN": { "regionid": "NEAS", "country": "Mongolia" },
  "MO": { "regionid": "NEAS", "country": "Macau" },
  "RU": { "regionid": "NEAS", "country": "Russian Federation" },
  "TW": { "regionid": "NEAS", "country": "Taiwan" },

  "BR": { "regionid": "NSAM", "country": "Brazil" },
  "CO": { "regionid": "NSAM", "country": "Colombia" },
  "CR": { "regionid": "NSAM", "country": "Costa Rica" },
  "CW": { "regionid": "NSAM", "country": "Curaçao" },
  "EC": { "regionid": "NSAM", "country": "Ecuador" },
  "GD": { "regionid": "NSAM", "country": "Grenada" },
  "GT": { "regionid": "NSAM", "country": "Guatemala" },
  "GY": { "regionid": "NSAM", "country": "Guyana" },
  "PA": { "regionid": "NSAM", "country": "Panama" },
  "PE": { "regionid": "NSAM", "country": "Peru" },
  "SR": { "regionid": "NSAM", "country": "Suriname" },

  "AU": { "regionid": "OC", "country": "Australia" },
  "NZ": { "regionid": "OC", "country": "New Zealand" },

  "AO": { "regionid": "SAF", "country": "Angola" },
  "BW": { "regionid": "SAF", "country": "Botswana" },
  "KE": { "regionid": "SAF", "country": "Kenya" },
  "MG": { "regionid": "SAF", "country": "Madagascar" },
  "MU": { "regionid": "SAF", "country": "Mauritius" },
  "MZ": { "regionid": "SAF", "country": "Mozambique" },
  "RE": { "regionid": "SAF", "country": "Reunion" },
  "RW": { "regionid": "SAF", "country": "Rwanda" },
  "TZ": { "regionid": "SAF", "country": "Tanzania" },
  "ZA": { "regionid": "SAF", "country": "South Africa" },
  "ZW": { "regionid": "SAF", "country": "Zimbabwe" },

  "BD": { "regionid": "SAS", "country": "Bangladesh" },
  "IN": { "regionid": "SAS", "country": "India" },
  "KZ": { "regionid": "SAS", "country": "Kazakhstan" },
  "LK": { "regionid": "SAS", "country": "Sri Lanka" },
  "MV": { "regionid": "SAS", "country": "Maldives" },
  "NP": { "regionid": "SAS", "country": "Nepal" },
  "PK": { "regionid": "SAS", "country": "Pakistan" },
  "UZ": { "regionid": "SAS", "country": "Uzbekistan" },

  "BN": { "regionid": "SEAS", "country": "Brunei Darussalam" },
  "BT": { "regionid": "SEAS", "country": "Bhutan" },
  "GU": { "regionid": "SEAS", "country": "Guam" },
  "ID": { "regionid": "SEAS", "country": "Indonesia" },
  "KH": { "regionid": "SEAS", "country": "Cambodia" },
  "LA": { "regionid": "SEAS", "country": "Laos" },
  "MM": { "regionid": "SEAS", "country": "Myanmar" },
  "MY": { "regionid": "SEAS", "country": "Malaysia" },
  "PH": { "regionid": "SEAS", "country": "Philippines" },
  "SG": { "regionid": "SEAS", "country": "Singapore" },
  "TH": { "regionid": "SEAS", "country": "Thailand" },
  "VN": { "regionid": "SEAS", "country": "Vietnam" },

  "AR": { "regionid": "SSAM", "country": "Argentina" },
  "CL": { "regionid": "SSAM", "country": "Chile" },
  "PY": { "regionid": "SSAM", "country": "Paraguay" },

  "BE": { "regionid": "WEU", "country": "Belgium" },
  "CH": { "regionid": "WEU", "country": "Switzerland" },
  "DE": { "regionid": "WEU", "country": "Germany" },
  "ES": { "regionid": "WEU", "country": "Spain" },
  "FR": { "regionid": "WEU", "country": "France" },
  "GB": { "regionid": "WEU", "country": "United Kingdom" },
  "IE": { "regionid": "WEU", "country": "Ireland" },
  "IS": { "regionid": "WEU", "country": "Iceland" },
  "IT": { "regionid": "WEU", "country": "Italy" },
  "LU": { "regionid": "WEU", "country": "Luxembourg" },
  "NC": { "regionid": "WEU", "country": "New Caledonia" },
  "NL": { "regionid": "WEU", "country": "Netherlands" },
  "PT": { "regionid": "WEU", "country": "Portugal" },

  "CA": { "regionid": "WNAM", "country": "Canada" },
  "HT": { "regionid": "WNAM", "country": "Haiti" },
  "MX": { "regionid": "WNAM", "country": "Mexico" },
  "US": { "regionid": "WNAM", "country": "United States" },

  "XX": { "regionid": "UNK", "country": "Unknown" },
  "T1": { "regionid": "UNK", "country": "Tor" }
};

const REGIONS = {
  "EEU": {
      "region": "Eastern Europe",
      "origins": [ "j8ayd8ayn23.eu-de.codeengine.appdomain.cloud", "y2inoz01f4q.eu-de.codeengine.appdomain.cloud", "j8ahcaxwtd1.au-syd.codeengine.appdomain.cloud", "j8clybxvjr0.us-south.codeengine.appdomain.cloud" ]
  },
  "WEU": {
      "region": "Western Europe",
      "origins": [ "j8ayd8ayn23.eu-de.codeengine.appdomain.cloud", "y2inoz01f4q.eu-de.codeengine.appdomain.cloud", "j8ahcaxwtd1.au-syd.codeengine.appdomain.cloud", "j8clybxvjr0.us-south.codeengine.appdomain.cloud" ]
  },
  "ME": {
      "region": "Middle East",
      "origins": [ "y2inoz01f4q.eu-de.codeengine.appdomain.cloud", "j8ayd8ayn23.eu-de.codeengine.appdomain.cloud", "j8ahcaxwtd1.au-syd.codeengine.appdomain.cloud", "j8clybxvjr0.us-south.codeengine.appdomain.cloud" ]
  },
  "NAF": {
      "region": "Northern Africa",
      "origins": [ "y2inoz01f4q.eu-de.codeengine.appdomain.cloud", "j8ayd8ayn23.eu-de.codeengine.appdomain.cloud", "j8ahcaxwtd1.au-syd.codeengine.appdomain.cloud", "j8clybxvjr0.us-south.codeengine.appdomain.cloud" ]
  },
  "SAF": {
      "region": "Southern Africa",
      "origins": [ "y2inoz01f4q.eu-de.codeengine.appdomain.cloud", "j8ayd8ayn23.eu-de.codeengine.appdomain.cloud", "j8ahcaxwtd1.au-syd.codeengine.appdomain.cloud", "j8clybxvjr0.us-south.codeengine.appdomain.cloud" ]
  },



  "WNAM": {
      "region": "Western North America",
      "origins": [ "j8clybxvjr0.us-south.codeengine.appdomain.cloud", "j8ayd8ayn23.eu-de.codeengine.appdomain.cloud", "y2inoz01f4q.eu-de.codeengine.appdomain.cloud", "j8ahcaxwtd1.au-syd.codeengine.appdomain.cloud" ]
  },
  "ENAM": {
      "region": "Eastern North America",
      "origins": [ "j8clybxvjr0.us-south.codeengine.appdomain.cloud", "j8ayd8ayn23.eu-de.codeengine.appdomain.cloud", "y2inoz01f4q.eu-de.codeengine.appdomain.cloud", "j8ahcaxwtd1.au-syd.codeengine.appdomain.cloud" ]
  },
  "NSAM": {
      "region": "Northern South America",
      "origins": [ "j8clybxvjr0.us-south.codeengine.appdomain.cloud", "j8ayd8ayn23.eu-de.codeengine.appdomain.cloud", "y2inoz01f4q.eu-de.codeengine.appdomain.cloud", "j8ahcaxwtd1.au-syd.codeengine.appdomain.cloud" ]
  },
  "SSAM": {
      "region": "Southern South America",
      "origins": [ "j8clybxvjr0.us-south.codeengine.appdomain.cloud", "j8ayd8ayn23.eu-de.codeengine.appdomain.cloud", "y2inoz01f4q.eu-de.codeengine.appdomain.cloud", "j8ahcaxwtd1.au-syd.codeengine.appdomain.cloud" ]
  },



  "OC": {
      "region": "Oceania",
      "origins": [ "j8ahcaxwtd1.au-syd.codeengine.appdomain.cloud", "j8clybxvjr0.us-south.codeengine.appdomain.cloud", "j8ayd8ayn23.eu-de.codeengine.appdomain.cloud", "y2inoz01f4q.eu-de.codeengine.appdomain.cloud" ]
  },
  "SAS": {
      "region": "Southern Asia",
      "origins": [ "j8ahcaxwtd1.au-syd.codeengine.appdomain.cloud", "j8clybxvjr0.us-south.codeengine.appdomain.cloud", "j8ayd8ayn23.eu-de.codeengine.appdomain.cloud", "y2inoz01f4q.eu-de.codeengine.appdomain.cloud" ]
  },
  "NEAS": {
      "region": "Northeast Asia",
      "origins": [ "j8ahcaxwtd1.au-syd.codeengine.appdomain.cloud", "j8clybxvjr0.us-south.codeengine.appdomain.cloud", "j8ayd8ayn23.eu-de.codeengine.appdomain.cloud", "y2inoz01f4q.eu-de.codeengine.appdomain.cloud" ]
  },
  "SEAS": {
      "region": "Southeast Asia",
      "origins": [ "j8ahcaxwtd1.au-syd.codeengine.appdomain.cloud", "j8clybxvjr0.us-south.codeengine.appdomain.cloud", "j8ayd8ayn23.eu-de.codeengine.appdomain.cloud", "y2inoz01f4q.eu-de.codeengine.appdomain.cloud" ]
  },



  "UNK": {
      "region": "Unknown",
      "origins": [ "y2inoz01f4q.eu-de.codeengine.appdomain.cloud", "j8ahcaxwtd1.au-syd.codeengine.appdomain.cloud", "j8ayd8ayn23.eu-de.codeengine.appdomain.cloud", "j8clybxvjr0.us-south.codeengine.appdomain.cloud" ]
  }
};