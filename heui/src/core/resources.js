// HeUi — resource loading.
//
// Assets are declared in the project manifest and loaded at boot. The loader
// abstracts over `fetch` (browser/WebView) and `fs` (Node) so a project can
// be authored once.

export class ResourceLoader {
  constructor(platform) {
    this.platform = platform;
    this.assets = new Map();
    this.cache = new Map();
  }

  /** Declares an asset without loading it yet. */
  declare(name, options) {
    this.assets.set(name, { name, ...options });
    return this;
  }

  async load(name) {
    if (this.cache.has(name)) return this.cache.get(name);
    const asset = this.assets.get(name);
    if (!asset) throw new Error(`unknown asset: ${name}`);

    const data = await this.platform.loadAsset(asset.path, asset.type);
    this.cache.set(name, data);
    return data;
  }

  async loadAll(names) {
    const results = {};
    for (const name of names) {
      results[name] = await this.load(name);
    }
    return results;
  }

  get(name) {
    return this.cache.get(name) || null;
  }
}
