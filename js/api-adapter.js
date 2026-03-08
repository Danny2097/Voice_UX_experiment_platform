/**
 * MUSEUM API ADAPTER PLATFORM
 * =============================
 * 
 * Unified adapter pattern for museum and cultural heritage APIs
 * Supports standard fetch and two-step ID-based fetch strategies
 * 
 * REGISTERED ADAPTERS:
 * 1. vam-v2           — Victoria & Albert Museum (standard fetch, no auth)
 * 2. europeana        — Europeana (standard fetch, requires API key)
 * 3. met-museum       — The Met (two-step ID fetch, no auth)
 * 4. wellcome         — Wellcome Collection (standard fetch, no auth)
 * 5. science-museum   — Science Museum Group (standard fetch, no auth)
 * 6. getty            — J. Paul Getty Museum (standard fetch, no auth)
 */

// ============================================================================
// PLATFORM CONFIG
// ============================================================================

const PLATFORM_CONFIG = {
  timeout: 10000,
  maxParallelRequests: 10,
  retryAttempts: 2,
  userAgent: 'VoiceControlResearchPlatform/1.0',
};

// ============================================================================
// PATH RESOLVER UTILITY
// ============================================================================

/**
 * Resolves nested object paths with array index support
 * Examples:
 *   resolvePath({a: {b: [1, 2]}}, 'a.b[0]') → 1
 *   resolvePath({title: 'Test'}, 'title') → 'Test'
 *   resolvePath({items: [...]}, 'items') → [...]
 */
function resolvePath(obj, path) {
  if (!path || !obj) return undefined;
  
  const segments = path.split('.');
  let current = obj;
  
  for (const segment of segments) {
    if (!current) return undefined;
    
    // Handle array index notation: 'field[0]' or 'field[0].nested'
    const arrayMatch = segment.match(/^([^\[]+)\[(\d+)\]$/);
    if (arrayMatch) {
      const [, fieldName, index] = arrayMatch;
      current = current[fieldName];
      if (!Array.isArray(current)) return undefined;
      current = current[parseInt(index)];
    } else {
      current = current[segment];
    }
  }
  
  return current;
}

// ============================================================================
// ADAPTER CLASS
// ============================================================================

class ApiAdapter {
  /**
   * @param {Object} descriptor - Adapter descriptor with name, description, config
   */
  constructor(descriptor) {
    this.id = descriptor.id;
    this.name = descriptor.name;
    this.description = descriptor.description;
    this.category = descriptor.category || 'General';
    this.requiresKey = descriptor.requiresKey || false;
    this.keyInstructions = descriptor.keyInstructions || null;
    this.note = descriptor.note || null;
    this.docsUrl = descriptor.docsUrl || null;
    this.config = descriptor.config;
  }

  /**
   * Validates that required config values are set (especially auth)
   */
  validate() {
    if (!this.config.endpoint) {
      throw new Error(`Adapter ${this.id}: missing endpoint`);
    }
    if (this.config.authType === 'apikey' && !this.config.authValue) {
      throw new Error(`Adapter ${this.id}: requires API key`);
    }
    if (this.config.fetchStrategy === 'two-step-ids' && !this.config.objectEndpoint) {
      throw new Error(`Adapter ${this.id}: two-step strategy requires objectEndpoint`);
    }
  }

  /**
   * Builds the full URL with query parameters and auth
   */
  buildUrl(query = null, page = 1) {
    const url = new URL(this.config.endpoint);
    
    // Parse and apply default params
    if (this.config.defaultParams) {
      try {
        const defaultParams = JSON.parse(this.config.defaultParams);
        Object.entries(defaultParams).forEach(([key, value]) => {
          url.searchParams.set(key, value);
        });
      } catch (e) {
        console.warn(`Failed to parse defaultParams for ${this.id}:`, e);
      }
    }

    // Add voice query if provided
    if (query) {
      url.searchParams.set(this.config.voiceParamKey, query);
    }

    // Add pagination
    const pageParam = this.config.pageParam || 'page';
    if (page > 1) {
      url.searchParams.set(pageParam, page);
    }

    // Handle API key auth via query parameter (for Europeana, etc.)
    if (this.config.authType === 'apikey' && this.config.authParamName && this.config.authValue) {
      url.searchParams.set(this.config.authParamName, this.config.authValue);
    }

    return url.toString();
  }

  /**
   * Maps a raw API response item to standard Item shape
   */
  mapItem(rawItem) {
    const mapping = this.config.mapping;
    let item = {
      id: resolvePath(rawItem, mapping.id),
      title: resolvePath(rawItem, mapping.title),
      subtitle: resolvePath(rawItem, mapping.subtitle),
      description: resolvePath(rawItem, mapping.description),
      imageUrl: resolvePath(rawItem, mapping.imageUrl),
      tags: resolvePath(rawItem, mapping.tags),
      raw: rawItem,
    };

    // Ensure tags is always an array
    if (!Array.isArray(item.tags)) {
      item.tags = item.tags ? [item.tags] : [];
    }

    // Special handling for Met Museum tags: array of objects with 'term' key
    if (item.tags.length > 0 && typeof item.tags[0] === 'object' && item.tags[0].term) {
      item.tags = item.tags.map(t => t.term);
    }

    // Ensure all string fields are non-null
    item.id = item.id || '';
    item.title = item.title || '(Untitled)';
    item.subtitle = item.subtitle || '';
    item.description = item.description || '';
    item.imageUrl = item.imageUrl || '';

    return item;
  }

  /**
   * Standard fetch strategy: single request to search endpoint
   */
  async _fetchStandard(query = null, page = 1) {
    const url = this.buildUrl(query, page);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': PLATFORM_CONFIG.userAgent,
        'Accept': 'application/json',
      },
      timeout: PLATFORM_CONFIG.timeout,
    });

    if (!response.ok) {
      throw new Error(`${this.id} API error: ${response.status} ${response.statusText}`);
    }

    const raw = await response.json();
    const itemsPath = this.config.mapping.itemsPath;
    const items = resolvePath(raw, itemsPath) || [];
    const total = resolvePath(raw, this.config.mapping.totalPath) || 0;

    return {
      items: items.map(item => this.mapItem(item)),
      total,
      page,
      raw,
    };
  }

  /**
   * Two-step fetch strategy: first get IDs, then fetch each object
   * 
   * Flow:
   * 1. Hit search endpoint → get array of IDs
   * 2. Take first maxItems IDs
   * 3. Fetch each via objectEndpoint (replace {id} with each ID)
   * 4. Map each response using mapItem
   * 5. Return { items, total, page, raw }
   * 
   * Limits to 10 parallel fetches to avoid rate limiting
   */
  async _fetchTwoStepIds(query = null, page = 1) {
    const url = this.buildUrl(query, page);
    
    // Step 1: Fetch search results to get IDs
    const searchResponse = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': PLATFORM_CONFIG.userAgent,
        'Accept': 'application/json',
      },
      timeout: PLATFORM_CONFIG.timeout,
    });

    if (!searchResponse.ok) {
      throw new Error(`${this.id} search error: ${searchResponse.status} ${searchResponse.statusText}`);
    }

    const searchData = await searchResponse.json();
    const idArrayPath = this.config.mapping.itemsPath;
    const idArray = resolvePath(searchData, idArrayPath) || [];
    const total = resolvePath(searchData, this.config.mapping.totalPath) || 0;

    // Step 2: Take first maxItems IDs
    const ids = idArray.slice(0, this.config.maxItems || 20);

    // Step 3 & 4: Fetch each object in parallel (limited to 10 at a time)
    const items = [];
    const objectTemplate = this.config.objectEndpoint;

    for (let i = 0; i < ids.length; i += PLATFORM_CONFIG.maxParallelRequests) {
      const batchIds = ids.slice(i, i + PLATFORM_CONFIG.maxParallelRequests);
      const batchPromises = batchIds.map(id => {
        const objectUrl = objectTemplate.replace('{id}', id);
        return fetch(objectUrl, {
          method: 'GET',
          headers: {
            'User-Agent': PLATFORM_CONFIG.userAgent,
            'Accept': 'application/json',
          },
          timeout: PLATFORM_CONFIG.timeout,
        })
          .then(res => res.ok ? res.json() : Promise.reject(new Error(`Failed to fetch object ${id}`)))
          .catch(err => {
            console.warn(`Failed to fetch object ${id}:`, err.message);
            return null;
          });
      });

      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
          items.push(this.mapItem(result.value));
        }
      });
    }

    return {
      items,
      total,
      page,
      raw: searchData,
    };
  }

  /**
   * Main fetch method with strategy routing
   */
  async fetch(query = null, page = 1) {
    const strategy = this.config.fetchStrategy || 'standard';
    
    if (strategy === 'two-step-ids') {
      return this._fetchTwoStepIds(query, page);
    }
    
    return this._fetchStandard(query, page);
  }
}

// ============================================================================
// ADAPTER REGISTRY
// ============================================================================

class _AdapterRegistry {
  constructor() {
    this.adapters = {};
  }

  register(descriptor) {
    const adapter = new ApiAdapter(descriptor);
    this.adapters[descriptor.id] = adapter;
    return adapter;
  }

  get(id) {
    return this.adapters[id];
  }

  has(id) {
    return id in this.adapters;
  }

  list() {
    return Object.entries(this.adapters).map(([id, adapter]) => ({
      id,
      name: adapter.name,
      description: adapter.description,
      category: adapter.category,
      requiresKey: adapter.requiresKey,
      note: adapter.note,
      keyInstructions: adapter.keyInstructions,
      docsUrl: adapter.docsUrl,
    }));
  }

  ids() {
    return Object.keys(this.adapters);
  }
}

const adapterRegistry = new _AdapterRegistry();

// ============================================================================
// BROWSER GLOBALS
// Always expose to window so index.html and experiment.html can use these
// without a module bundler.
// ============================================================================

window.ApiAdapter          = ApiAdapter;
window.apiAdapterRegistry  = adapterRegistry;   // the singleton instance
window.VRP_CONFIG          = PLATFORM_CONFIG;

// ============================================================================
// ADAPTERS: LOCAL MOCK MUSEUM
// ============================================================================

apiAdapterRegistry.register({
  id: 'local-mock',
  name: 'Local Mock Museum',
  description: 'Completely offline mock API for testing and platform demonstrations.',
  category: 'System',
  requiresKey: false,
  config: {
    endpoint: '/api/mock-data',
    authType: 'none',
    authValue: '',
    defaultParams: '{}',
    voiceParamKey: 'q',
    maxItems: 10,
    fetchStrategy: 'standard',
    mapping: {
      itemsPath: 'items',
      totalPath: 'count',
      id: 'id',
      title: 'title',
      subtitle: 'maker',
      description: 'description',
      imageUrl: 'image',
      tags: 'category',
    },
  },
});

// ============================================================================
// ADAPTERS: VICTORIA & ALBERT MUSEUM
// ============================================================================

adapterRegistry.register({
  id: 'vam-v2',
  name: 'Victoria & Albert Museum',
  description: 'V&A Collection API v2 — over 1.2 million objects',
  category: 'Art & Design',
  docsUrl: 'https://developers.vam.ac.uk/guide/v2/welcome.html',
  requiresKey: false,
  config: {
    endpoint: 'https://api.vam.ac.uk/v2/objects/search',
    authType: 'none',
    authValue: '',
    defaultParams: '{"page_size": 20, "images_exist": true}',
    voiceParamKey: 'q',
    maxItems: 20,
    fetchStrategy: 'standard',
    mapping: {
      itemsPath: 'records',
      totalPath: 'info.record_count',
      id: 'systemNumber',
      title: '_primaryTitle',
      subtitle: '_primaryMaker.name',
      description: '_primaryDescription.value',
      imageUrl: '_images._primary_thumbnail',
      tags: '_objectType',
    },
  },
});

// ============================================================================
// ADAPTERS: EUROPEANA
// ============================================================================

adapterRegistry.register({
  id: 'europeana',
  name: 'Europeana',
  description: 'Europeana — millions of digitised items from European cultural institutions',
  category: 'European Heritage',
  docsUrl: 'https://apis.europeana.eu/en',
  requiresKey: true,
  keyInstructions: 'Register for a free API key at https://apis.europeana.eu/en and enter it as the Auth Value. Set Auth Type to "apikey".',
  config: {
    endpoint: 'https://api.europeana.eu/record/v2/search.json',
    authType: 'apikey',
    authValue: 'YOUR_EUROPEANA_KEY',
    authParamName: 'wskey',
    defaultParams: '{"rows": 20, "profile": "standard"}',
    voiceParamKey: 'query',
    maxItems: 20,
    fetchStrategy: 'standard',
    mapping: {
      itemsPath: 'items',
      totalPath: 'totalResults',
      id: 'id',
      title: 'title[0]',
      subtitle: 'dcCreator[0]',
      description: 'dcDescription[0]',
      imageUrl: 'edmIsShownBy[0]',
      tags: 'type',
    },
  },
});

// ============================================================================
// ADAPTERS: THE METROPOLITAN MUSEUM OF ART
// ============================================================================

adapterRegistry.register({
  id: 'met-museum',
  name: 'The Metropolitan Museum of Art',
  description: 'The Met Collection — 500,000+ works spanning 5,000 years',
  category: 'Art & Design',
  docsUrl: 'https://metmuseum.github.io/',
  requiresKey: false,
  config: {
    endpoint: 'https://collectionapi.metmuseum.org/public/collection/v1/search',
    objectEndpoint: 'https://collectionapi.metmuseum.org/public/collection/v1/objects/{id}',
    authType: 'none',
    authValue: '',
    defaultParams: '{"hasImages": true}',
    voiceParamKey: 'q',
    maxItems: 20,
    fetchStrategy: 'two-step-ids',
    mapping: {
      itemsPath: 'objectIDs',
      totalPath: 'total',
      id: 'objectID',
      title: 'title',
      subtitle: 'artistDisplayName',
      description: 'objectName',
      imageUrl: 'primaryImageSmall',
      tags: 'department',
    },
  },
});

// ============================================================================
// ADAPTERS: WELLCOME COLLECTION
// ============================================================================

adapterRegistry.register({
  id: 'wellcome',
  name: 'Wellcome Collection',
  description: 'Wellcome Collection — health & human experience archives from London',
  category: 'Medical History',
  docsUrl: 'https://developers.wellcomecollection.org/docs/api',
  requiresKey: false,
  config: {
    endpoint: 'https://api.wellcomecollection.org/catalogue/v2/works',
    authType: 'none',
    authValue: '',
    defaultParams: '{"pageSize": 20, "include": "subjects"}',
    voiceParamKey: 'query',
    maxItems: 20,
    fetchStrategy: 'standard',
    mapping: {
      itemsPath: 'results',
      totalPath: 'totalResults',
      id: 'id',
      title: 'title',
      subtitle: 'contributors[0].agent.label',
      description: 'description',
      imageUrl: 'thumbnail.url',
      tags: 'workType.label',
    },
  },
});

// ============================================================================
// ADAPTERS: SCIENCE MUSEUM GROUP
// ============================================================================

adapterRegistry.register({
  id: 'science-museum',
  name: 'Science Museum Group',
  description: 'Science Museum Group Collection — science, technology, and industry',
  category: 'Science & Technology',
  docsUrl: 'https://www.sciencemuseumgroup.org.uk/our-work/our-collection/using-our-collection-api',
  requiresKey: false,
  config: {
    endpoint: 'https://collection.sciencemuseumgroup.org.uk/search',
    authType: 'none',
    authValue: '',
    defaultParams: '{"page[size]": 20}',
    voiceParamKey: 'q',
    maxItems: 20,
    fetchStrategy: 'standard',
    mapping: {
      itemsPath: 'data',
      totalPath: 'meta.hit_count',
      id: 'id',
      title: 'attributes.summary_title',
      subtitle: 'attributes.lifecycle.creation[0].maker[0].summary_title',
      description: 'attributes.description[0].value',
      imageUrl: 'attributes.multimedia[0].processed.thumbnail.location',
      tags: 'attributes.categories[0].value',
    },
  },
});

// ============================================================================
// ADAPTERS: J. PAUL GETTY MUSEUM
// ============================================================================

adapterRegistry.register({
  id: 'getty',
  name: 'J. Paul Getty Museum',
  description: 'Getty Museum Collection — art from antiquity to the present (Linked Art/LOD API)',
  category: 'Art & Design',
  docsUrl: 'https://data.getty.edu/museum/collection/docs/',
  requiresKey: false,
  note: 'Uses Linked Art (JSON-LD) format. Full-text search support is limited — browse by object type or use direct object IDs.',
  config: {
    endpoint: 'https://data.getty.edu/museum/collection/object/',
    authType: 'none',
    authValue: '',
    defaultParams: '{}',
    voiceParamKey: 'q',
    maxItems: 20,
    fetchStrategy: 'standard',
    mapping: {
      itemsPath: 'items',
      totalPath: 'total',
      id: 'id',
      title: '_label',
      subtitle: 'produced_by.carried_out_by[0]._label',
      description: 'referred_to_by[0].content',
      imageUrl: 'representation[0].id',
      tags: 'classified_as[0]._label',
    },
  },
});

// ============================================================================
// NODE / CommonJS EXPORT (used if loaded via require() in proxy/tests)
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ApiAdapter,
    AdapterRegistry: _AdapterRegistry,
    apiAdapterRegistry: adapterRegistry,
    adapterRegistry,
    resolvePath,
    PLATFORM_CONFIG,
  };
}
