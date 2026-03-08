/**
 * =============================================================================
 * VOICE CONTROL RESEARCH PLATFORM - CUSTOM ADAPTER EXAMPLE
 * Victoria & Albert Museum (VAM) Collection API v2
 * =============================================================================
 *
 * THIS FILE IS DOCUMENTATION-AS-CODE.
 *
 * It demonstrates, step-by-step, how to write a custom adapter for the Voice
 * Control Research Platform. While this example uses the VAM API, the patterns
 * shown here apply to any REST API with JSON responses.
 *
 * This file is heavily commented for educational purposes and is meant to be
 * READ rather than directly imported. The VAM adapter is already pre-registered
 * in api-adapter.js, so you don't need to copy this code.
 *
 * HOWEVER, you can use this as a template when connecting a new API!
 *
 * =============================================================================
 * STEP 0: UNDERSTAND THE TARGET API
 * =============================================================================
 *
 * Before writing an adapter, study the API documentation:
 *
 * Victoria & Albert Museum Collection API v2
 * - Docs: https://developers.vam.ac.uk/guide/v2/welcome.html
 * - Base URL: https://api.vam.ac.uk/v2/objects/search
 * - Authentication: None required (public API)
 * - Query params: 'q' for search, 'page_size' for limit, 'images_exist' to filter
 *
 * EXAMPLE REQUEST:
 *   https://api.vam.ac.uk/v2/objects/search?q=pottery&page_size=20&images_exist=true
 *
 * EXAMPLE RESPONSE (simplified):
 * {
 *   "records": [
 *     {
 *       "systemNumber": "O1234567",
 *       "_primaryTitle": "Vase",
 *       "_primaryMaker": {
 *         "name": "John Smith"
 *       },
 *       "_primaryDescription": {
 *         "value": "An earthenware vase, decorated with..."
 *       },
 *       "_images": {
 *         "_primary_thumbnail": "https://example.com/image.jpg"
 *       },
 *       "_objectType": "Ceramic",
 *       // ... many other fields (they're preserved in item.raw for reference)
 *     },
 *     // ... more records
 *   ],
 *   "info": {
 *     "count": 2500,
 *     "pages": 125,
 *     "page": 1
 *   }
 * }
 *
 * =============================================================================
 * STEP 1: CREATE THE CONFIGURATION OBJECT
 * =============================================================================
 *
 * A configuration object tells the ApiAdapter how to:
 *   - Where to connect (endpoint)
 *   - How to authenticate (if needed)
 *   - What default parameters to always send
 *   - Which parameter key to use for voice search
 *   - How to map raw API fields to the standard Item shape
 *
 * Think of it as a "translation key" between the API's response format and
 * the platform's standard Item format.
 */

// Here's the VAM config. Notice the field mapping strategy below.
const vamAdapterConfig = {
  // The base API endpoint URL
  endpoint: 'https://api.vam.ac.uk/v2/objects/search',

  // Authentication type: 'none', 'bearer', or 'apikey'
  // VAM API requires no authentication, so we use 'none'
  authType: 'none',
  authValue: '',

  // Default query parameters sent with every request (as JSON string)
  // These ensure we always get images and limit results to 20 per page
  defaultParams: '{"page_size": 20, "images_exist": true}',

  // The query parameter name that receives voice input
  // When a user searches for "pottery", we send: ?q=pottery
  voiceParamKey: 'q',

  // Maximum items per request (should match page_size above)
  maxItems: 20,

  // Field mapping: transforms raw API response to standard Item shape
  // Each key is an Item field; each value is a dot-notation path in the raw object
  mapping: {
    // The path to the array of items in the API response
    // VAM returns results in data.records (not data.items or data.results)
    itemsPath: 'records',

    // Map id: get the 'systemNumber' field from each record
    id: 'systemNumber',

    // Map title: get the '_primaryTitle' field
    // (VAM uses leading underscores for computed fields)
    title: '_primaryTitle',

    // Map subtitle: navigate two levels deep
    // Using dot notation to get _primaryMaker.name
    // If maker is null, this will safely become an empty string
    subtitle: '_primaryMaker.name',

    // Map description: another nested path
    description: '_primaryDescription.value',

    // Map imageUrl: nested within _images
    // If the image doesn't exist, the adapter will return null
    imageUrl: '_images._primary_thumbnail',

    // Map tags: get the _objectType field (e.g., "Ceramic", "Glass")
    // The adapter automatically handles both single strings and arrays
    tags: '_objectType'
  }
};

/**
 * =============================================================================
 * STEP 2: UNDERSTAND FIELD MAPPING IN DETAIL
 * =============================================================================
 *
 * Field mapping is the heart of the adapter pattern. Here's how it works:
 *
 * 1. The raw API response has a specific JSON structure (e.g., VAM's structure)
 * 2. The platform expects Items in a standard shape
 * 3. The mapping tells the adapter how to translate from #1 to #2
 *
 * MAPPING SYNTAX:
 *   - Use dots to navigate nested objects: a.b.c => obj.a.b.c
 *   - Use brackets for array indices: a[0].b => obj.a[0].b
 *   - Use bracket notation for keys: a['key'].b => obj.a['key'].b
 *
 * EXAMPLE TRANSFORMATIONS:
 *
 * Raw VAM response:
 * {
 *   "systemNumber": "O1234567",
 *   "_primaryTitle": "Ceramic Vase",
 *   "_primaryMaker": {
 *     "name": "John Smith"
 *   },
 *   "_primaryDescription": {
 *     "value": "A decorated earthenware vase from the Ming Dynasty..."
 *   },
 *   "_images": {
 *     "_primary_thumbnail": "https://vam.ac.uk/api/2/img/O1234567"
 *   },
 *   "_objectType": "Ceramic"
 * }
 *
 * Becomes this standard Item:
 * {
 *   id: "O1234567",                     // from 'systemNumber'
 *   title: "Ceramic Vase",              // from '_primaryTitle'
 *   subtitle: "John Smith",             // from '_primaryMaker.name'
 *   description: "A decorated...",      // from '_primaryDescription.value'
 *   imageUrl: "https://vam.ac.uk/...",  // from '_images._primary_thumbnail'
 *   tags: ["Ceramic"],                  // from '_objectType' (wrapped in array)
 *   raw: { ... }                        // original object (for debugging)
 * }
 *
 * The mapItem() function in ApiAdapter handles all this transformation.
 */

/**
 * =============================================================================
 * STEP 3: REGISTERING THE ADAPTER
 * =============================================================================
 *
 * Once you have a config, register it with the apiAdapterRegistry:
 */

// This code would normally go in your initialization script or
// directly in api-adapter.js (where the VAM adapter is already registered):
//
// apiAdapterRegistry.register('vam-v2', {
//   name: 'Victoria & Albert Museum Collection',
//   description: 'V&A Collection API v2 — over 1.2 million objects',
//   docsUrl: 'https://developers.vam.ac.uk/guide/v2/welcome.html',
//   config: vamAdapterConfig
// });
//
// The registry entry includes:
//   - id: unique identifier ('vam-v2')
//   - name: human-readable name for UI dropdowns
//   - description: brief description of the data source
//   - docsUrl: link to the API documentation
//   - config: the configuration object from Step 1

/**
 * =============================================================================
 * STEP 4: TESTING THE ADAPTER
 * =============================================================================
 *
 * Before using an adapter in production, test it:
 */

// In your HTML page or developer console:
//
// // Create an instance of the adapter
// const adapter = new ApiAdapter(vamAdapterConfig);
//
// // Test the connection and field mapping
// adapter.testConnection().then(result => {
//   if (result.success) {
//     console.log('SUCCESS! Sample item:', result.sampleItem);
//     console.log('Request took', result.timing.ms, 'ms');
//   } else {
//     console.error('FAILED:', result.error);
//   }
// });
//
// // Or test a specific search
// adapter.fetch('ceramic', 1).then(result => {
//   console.log('Found', result.items.length, 'items');
//   result.items.forEach(item => {
//     console.log('  - ', item.title, 'by', item.subtitle);
//   });
// });
//
// The testConnection() method will:
//   1. Make a request to the API
//   2. Verify the response structure
//   3. Check that field mapping works
//   4. Return a sample mapped item for inspection
//   5. Measure request timing
//
// If any step fails, you'll get an error message explaining why.

/**
 * =============================================================================
 * STEP 5: PAGINATION NOTES
 * =============================================================================
 *
 * Different APIs handle pagination differently. The VAM API uses offset-based
 * pagination with a 'page_size' parameter.
 *
 * VAM API PAGINATION:
 * - Query param: page_size (items per page, default 20)
 * - Query param: page (1-indexed page number)
 * - Response includes: info.count (total items), info.pages (total pages)
 *
 * EXAMPLE:
 *   Page 1: https://api.vam.ac.uk/v2/objects/search?q=pottery&page=1&page_size=20
 *   Page 2: https://api.vam.ac.uk/v2/objects/search?q=pottery&page=2&page_size=20
 *
 * OTHER PAGINATION STYLES:
 * - Cursor-based: Use a 'cursor' parameter to navigate results
 * - Offset-based: Use 'offset' and 'limit' instead of page numbers
 * - Link-based: Response includes URLs to next/previous pages
 *
 * HOW ADAPTERS HANDLE PAGINATION:
 * The adapter.fetch(query, page) method accepts a page parameter.
 * You can include page handling in defaultParams or handle it manually:
 *
 * // If the API uses 'page' as a query param:
 * defaultParams: '{"page_size": 20, "images_exist": true}'
 * // Then in fetch(), the page is passed separately and added by the caller
 *
 * // If you need custom pagination handling, override buildUrl():
 * buildUrl(query = null, page = 1) {
 *   // Custom logic here
 * }
 */

/**
 * =============================================================================
 * STEP 6: IMAGE URL HANDLING (IIIF FORMAT)
 * =============================================================================
 *
 * The VAM API returns images in IIIF (International Image Interoperability
 * Framework) format. This is a standard for image delivery on the web.
 *
 * VAM IMAGE URLS:
 * - Stored as: _images._primary_thumbnail
 * - Format: "https://api.vam.ac.uk/api/2/img/O1234567"
 * - This is a base IIIF image URL, not a direct image file
 *
 * IIIF PARAMETERS:
 * You can modify IIIF URLs to get different sizes and formats:
 *
 * Original (info.json):
 *   https://api.vam.ac.uk/api/2/img/O1234567/info.json
 *
 * Full image:
 *   https://api.vam.ac.uk/api/2/img/O1234567/full/400,/0/default.jpg
 *   (400 pixels wide, aspect ratio preserved)
 *
 * Square thumbnail:
 *   https://api.vam.ac.uk/api/2/img/O1234567/full/150,150/0/default.jpg
 *   (150x150 square)
 *
 * Rotated image:
 *   https://api.vam.ac.uk/api/2/img/O1234567/full/400,/90/default.jpg
 *   (90 degrees)
 *
 * USING IIIF IN YOUR ADAPTER:
 * If you need to customize image sizing, you can extend the mapItem() method:
 *
 *   mapItem(rawItem) {
 *     const item = super.mapItem(rawItem);
 *
 *     // Convert IIIF base URL to a sized thumbnail
 *     if (item.imageUrl) {
 *       item.imageUrl = item.imageUrl + '/full/300,/0/default.jpg';
 *     }
 *
 *     return item;
 *   }
 *
 * Most IIIF servers (including VAM) accept these parameters and will
 * return appropriate image files.
 */

/**
 * =============================================================================
 * STEP 7: ERROR HANDLING & DEBUGGING
 * =============================================================================
 *
 * When writing adapters, handle these common issues:
 *
 * 1. MISSING FIELDS
 *    Problem: Not every API item has all fields
 *    Solution: The adapter returns empty strings/nulls for missing fields
 *    Debug: Check item.raw to see the original data
 *
 * 2. WRONG FIELD PATHS
 *    Problem: You mapped title to 'name' but it's actually 'title'
 *    Solution: Use testConnection() to inspect the first item
 *    Debug: Look at the sample item's raw field
 *
 * 3. NESTED ARRAYS
 *    Problem: The API returns author_names: ["John", "Jane"]
 *    Solution: The adapter automatically joins arrays with commas
 *    Result: "John, Jane"
 *
 * 4. NULL/UNDEFINED SAFELY
 *    Problem: Accessing null.property crashes
 *    Solution: resolvePath() safely returns undefined if path breaks
 *    Result: No crashes, missing field becomes empty string
 *
 * 5. CORS ERRORS
 *    Problem: Fetch fails with "No 'Access-Control-Allow-Origin' header"
 *    Solution: Use the CORS proxy (window.VRP_CONFIG.useProxy = true)
 *    Fallback: Some APIs support CORS; check their docs
 *
 * 6. AUTHENTICATION ERRORS
 *    Problem: 401/403 responses from protected endpoints
 *    Solution: Set authType ('bearer' or 'apikey') and authValue
 *    Debug: Check buildHeaders() to verify your token is included
 */

/**
 * =============================================================================
 * STEP 8: FULL ADAPTER EXAMPLE (COMMENTED)
 * =============================================================================
 *
 * Here's a complete, annotated example of creating and using a VAM adapter:
 */

// 1. Define the configuration
//    This maps the VAM API response structure to the standard Item shape
const exampleVamConfig = {
  endpoint: 'https://api.vam.ac.uk/v2/objects/search',
  authType: 'none',  // No auth required
  authValue: '',
  defaultParams: '{"page_size": 20, "images_exist": true}',
  voiceParamKey: 'q',  // Voice searches use ?q=...
  maxItems: 20,
  mapping: {
    itemsPath: 'records',           // API returns results in 'records'
    id: 'systemNumber',             // Unique identifier
    title: '_primaryTitle',         // Main display text
    subtitle: '_primaryMaker.name', // Creator name (nested path)
    description: '_primaryDescription.value',  // Full description
    imageUrl: '_images._primary_thumbnail',    // Image URL (IIIF base)
    tags: '_objectType'             // Object category
  }
};

// 2. Create an adapter instance
//    (In real code, you'd use the registered adapter from the registry)
//    const adapter = new ApiAdapter(exampleVamConfig);

// 3. Test the connection
//    adapter.testConnection().then(result => {
//      if (result.success) {
//        console.log('Connected!');
//        console.log('Sample:', result.sampleItem);
//      }
//    });

// 4. Perform a search
//    adapter.fetch('pottery', 1).then(result => {
//      console.log(`Found ${result.items.length} items`);
//      result.items.forEach(item => {
//        console.log(`${item.title} by ${item.subtitle}`);
//        console.log(`  Image: ${item.imageUrl}`);
//        console.log(`  Tags: ${item.tags.join(', ')}`);
//      });
//    });

/**
 * =============================================================================
 * STEP 9: WRITING A CUSTOM ADAPTER FOR YOUR API
 * =============================================================================
 *
 * Use this template to write an adapter for a different API:
 *
 * 1. Read the API docs and make a sample request (e.g., in Postman or curl)
 * 2. Study the response JSON structure
 * 3. Create a mapping from API fields to Item fields using dot notation
 * 4. Fill in this template:
 *
 *    const myConfig = {
 *      endpoint: 'https://api.example.com/search',
 *      authType: 'none',  // or 'bearer' or 'apikey'
 *      authValue: '',  // Your auth token if needed
 *      defaultParams: '{"limit": 20}',  // API's default params
 *      voiceParamKey: 'q',  // What param key receives voice input?
 *      maxItems: 20,
 *      mapping: {
 *        itemsPath: 'results',  // Where are the items in the response?
 *        id: 'id',
 *        title: 'name',
 *        subtitle: 'author',
 *        description: 'summary',
 *        imageUrl: 'thumbnail.url',
 *        tags: 'category'
 *      }
 *    };
 *
 *    apiAdapterRegistry.register('my-api', {
 *      name: 'My Awesome API',
 *      description: 'Search millions of things',
 *      docsUrl: 'https://docs.example.com/',
 *      config: myConfig
 *    });
 *
 * 5. Test it:
 *    const adapter = new ApiAdapter(myConfig);
 *    adapter.testConnection().then(console.log);
 *
 * 6. Debug any issues using the error handling guide in Step 7
 *
 * That's it! Your custom adapter is now part of the platform.
 */

/**
 * =============================================================================
 * QUICK REFERENCE: ADAPTER CONFIGURATION CHECKLIST
 * =============================================================================
 *
 * Before registering a new adapter, verify:
 *
 * [ ] API endpoint URL is correct
 * [ ] Authentication method is set ('none', 'bearer', or 'apikey')
 * [ ] Auth token/key is provided (if required)
 * [ ] Default parameters are correct JSON
 * [ ] voiceParamKey matches the API's search parameter name
 * [ ] itemsPath points to the array of results in the response
 * [ ] All mapping keys (id, title, etc.) use correct paths
 * [ ] Paths use dot notation (a.b.c) and bracket notation (a[0].b)
 * [ ] testConnection() returns success with a valid sample item
 * [ ] fetch() returns Items with all required fields populated
 * [ ] Images display correctly (or are null if not available)
 * [ ] Tags are strings or can be converted to strings
 *
 * =============================================================================
 */

// This file is intentionally not exported. It's documentation-as-code.
// The actual VAM adapter is pre-registered in api-adapter.js.
// Use this file as a reference when writing your own adapters!
