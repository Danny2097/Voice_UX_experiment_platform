/**
 * MUSEUM API ADAPTER PLATFORM
 * =============================
 * 
 * Unified adapter pattern for museum and cultural heritage APIs
 * Supports standard fetch and two-step ID-based fetch strategies
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
 */
function resolvePath(obj, path) {
  if (!path || !obj) return undefined;
  
  const segments = path.split('.');
  let current = obj;
  
  for (const segment of segments) {
    if (!current) return undefined;
    
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

  validate() {
    if (!this.config.endpoint) {
      throw new Error(`Adapter ${this.id}: missing endpoint`);
    }
  }

  buildUrl(query = null, page = 1) {
    let baseUrl = window.location.origin;
    
    // If endpoint is relative, use origin
    if (this.config.endpoint.startsWith('/')) {
        baseUrl = window.location.origin;
    } else if (window.location.port === '8080') {
      if (this.config.endpoint.startsWith('/api')) {
        baseUrl = window.location.protocol + '//' + window.location.hostname + ':3002';
      } else if (this.config.endpoint.startsWith('/local-api') || this.config.endpoint.startsWith('/clothing-api')) {
        baseUrl = window.location.protocol + '//' + window.location.hostname + ':3003';
      }
    }

    const url = new URL(this.config.endpoint, baseUrl);
    
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

    if (query) {
      url.searchParams.set(this.config.voiceParamKey, query);
    }

    const pageParam = this.config.pageParam || 'page';
    if (page > 1) {
      url.searchParams.set(pageParam, page);
    }

    if (this.config.authType === 'apikey' && this.config.authParamName && this.config.authValue) {
      url.searchParams.set(this.config.authParamName, this.config.authValue);
    }

    return url.toString();
  }

  mapItem(rawItem) {
    const mapping = this.config.mapping;
    let item = {
      id: resolvePath(rawItem, mapping.id || 'id'),
      title: resolvePath(rawItem, mapping.title),
      subtitle: resolvePath(rawItem, mapping.subtitle),
      description: resolvePath(rawItem, mapping.description),
      imageUrl: resolvePath(rawItem, mapping.imageUrl || mapping.image),
      tags: resolvePath(rawItem, mapping.tags),
      raw: rawItem,
    };

    item.id = item.id || '';
    item.title = item.title || '(Untitled)';
    item.subtitle = item.subtitle || '';
    item.description = item.description || '';
    item.imageUrl = item.imageUrl || '';

    return item;
  }

  async _fetchStandard(query = null, page = 1) {
    const url = this.buildUrl(query, page);
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'User-Agent': PLATFORM_CONFIG.userAgent, 'Accept': 'application/json' },
    });
    if (!response.ok) throw new Error(`${this.id} error: ${response.status}`);
    const raw = await response.json();
    const items = resolvePath(raw, this.config.mapping.itemsPath) || [];
    const total = resolvePath(raw, this.config.mapping.totalPath) || 0;
    return { items: items.map(item => this.mapItem(item)), total, page, raw };
  }

  async _fetchTwoStepIds(query = null, page = 1) {
    const url = this.buildUrl(query, page);
    const searchRes = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!searchRes.ok) throw new Error(`${this.id} search error`);
    const searchData = await searchRes.json();
    const ids = (resolvePath(searchData, this.config.mapping.itemsPath) || []).slice(0, this.config.maxItems || 20);
    const items = [];
    for (const id of ids) {
      try {
        const objUrl = this.config.objectEndpoint.replace('{id}', id);
        const objRes = await fetch(objUrl, { headers: { 'Accept': 'application/json' } });
        if (objRes.ok) items.push(this.mapItem(await objRes.json()));
      } catch (e) { console.warn(e); }
    }
    return { items, total: resolvePath(searchData, this.config.mapping.totalPath) || 0, page, raw: searchData };
  }

  async fetch(query = null, page = 1) {
    if (this.config.fetchStrategy === 'two-step-ids') return this._fetchTwoStepIds(query, page);
    return this._fetchStandard(query, page);
  }
}

// ============================================================================
// ADAPTER REGISTRY
// ============================================================================

class _AdapterRegistry {
  constructor() { this.adapters = {}; }
  register(descriptor) {
    const adapter = new ApiAdapter(descriptor);
    this.adapters[descriptor.id] = adapter;
    return adapter;
  }
  get(id) { return this.adapters[id]; }
  list() {
    return Object.entries(this.adapters).map(([id, adapter]) => ({
      id, name: adapter.name, description: adapter.description, category: adapter.category, requiresKey: adapter.requiresKey
    }));
  }
}

const adapterRegistry = new _AdapterRegistry();
window.ApiAdapter = ApiAdapter;
window.apiAdapterRegistry = adapterRegistry;
window.VRP_CONFIG = PLATFORM_CONFIG;

// ============================================================================
// ADAPTERS: STANDALONE LOCAL API
// ============================================================================

apiAdapterRegistry.register({
  id: 'standalone-local-api',
  name: 'Standalone Local API',
  description: 'A dedicated REST API for 50 common objects, running locally without a database.',
  category: 'System',
  requiresKey: false,
  config: {
    endpoint: '/local-api',
    authType: 'none',
    authValue: '',
    defaultParams: '{}',
    voiceParamKey: 'q',
    maxItems: 50,
    fetchStrategy: 'standard',
    mapping: {
      itemsPath: 'items', totalPath: 'count', id: 'id', title: 'title', subtitle: 'subtitle', description: 'description', imageUrl: 'image', tags: 'category'
    },
  },
});

adapterRegistry.register({
  id: 'clothing-local-api',
  name: 'Clothing Dataset',
  description: 'Dedicated REST API for 50 clothing items (T-shirts, Jackets, Shoes, etc.).',
  category: 'System',
  requiresKey: false,
  config: {
    endpoint: '/clothing-api',
    authType: 'none',
    authValue: '',
    defaultParams: '{}',
    voiceParamKey: 'q',
    maxItems: 50,
    fetchStrategy: 'standard',
    mapping: {
      itemsPath: 'items', totalPath: 'count', id: 'id', title: 'title', subtitle: 'subtitle', description: 'description', imageUrl: 'image', tags: 'category'
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
      itemsPath: 'records', totalPath: 'info.record_count', id: 'systemNumber', title: '_primaryTitle', subtitle: '_primaryMaker.name', description: '_primaryDescription.value', imageUrl: '_images._primary_thumbnail', tags: '_objectType'
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
  keyInstructions: 'Register for a free API key at https://apis.europeana.eu/en',
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
      itemsPath: 'items', totalPath: 'totalResults', id: 'id', title: 'title[0]', subtitle: 'dcCreator[0]', description: 'dcDescription[0]', imageUrl: 'edmIsShownBy[0]', tags: 'type'
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
      itemsPath: 'objectIDs', totalPath: 'total', id: 'objectID', title: 'title', subtitle: 'artistDisplayName', description: 'objectName', imageUrl: 'primaryImageSmall', tags: 'department'
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
      itemsPath: 'results', totalPath: 'totalResults', id: 'id', title: 'title', subtitle: 'contributors[0].agent.label', description: 'description', imageUrl: 'thumbnail.url', tags: 'workType.label'
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
      itemsPath: 'data', totalPath: 'meta.hit_count', id: 'id', title: 'attributes.summary_title', subtitle: 'attributes.lifecycle.creation[0].maker[0].summary_title', description: 'attributes.description[0].value', imageUrl: 'attributes.multimedia[0].processed.thumbnail.location', tags: 'attributes.categories[0].value'
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
  config: {
    endpoint: 'https://data.getty.edu/museum/collection/object/',
    authType: 'none',
    authValue: '',
    defaultParams: '{}',
    voiceParamKey: 'q',
    maxItems: 20,
    fetchStrategy: 'standard',
    mapping: {
      itemsPath: 'items', totalPath: 'total', id: 'id', title: '_label', subtitle: 'produced_by.carried_out_by[0]._label', description: 'referred_to_by[0].content', imageUrl: 'representation[0].id', tags: 'classified_as[0]._label'
    },
  },
});

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ApiAdapter, adapterRegistry, PLATFORM_CONFIG };
}
