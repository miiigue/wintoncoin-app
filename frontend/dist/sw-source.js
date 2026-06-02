try {
  self["workbox:core:7.3.0"] && _();
} catch {
}
const re = (n, ...e) => {
  let t = n;
  return e.length > 0 && (t += ` :: ${JSON.stringify(e)}`), t;
}, oe = re;
class l extends Error {
  /**
   *
   * @param {string} errorCode The error code that
   * identifies this particular error.
   * @param {Object=} details Any relevant arguments
   * that will help developers identify issues should
   * be added as a key on the context object.
   */
  constructor(e, t) {
    const s = oe(e, t);
    super(s), this.name = e, this.details = t;
  }
}
const p = {
  googleAnalytics: "googleAnalytics",
  precache: "precache-v2",
  prefix: "workbox",
  runtime: "runtime",
  suffix: typeof registration < "u" ? registration.scope : ""
}, L = (n) => [p.prefix, n, p.suffix].filter((e) => e && e.length > 0).join("-"), ce = (n) => {
  for (const e of Object.keys(p))
    n(e);
}, T = {
  updateDetails: (n) => {
    ce((e) => {
      typeof n[e] == "string" && (p[e] = n[e]);
    });
  },
  getGoogleAnalyticsName: (n) => n || L(p.googleAnalytics),
  getPrecacheName: (n) => n || L(p.precache),
  getPrefix: () => p.prefix,
  getRuntimeName: (n) => n || L(p.runtime),
  getSuffix: () => p.suffix
};
function F(n, e) {
  const t = e();
  return n.waitUntil(t), t;
}
try {
  self["workbox:precaching:7.3.0"] && _();
} catch {
}
const he = "__WB_REVISION__";
function le(n) {
  if (!n)
    throw new l("add-to-cache-list-unexpected-type", { entry: n });
  if (typeof n == "string") {
    const i = new URL(n, location.href);
    return {
      cacheKey: i.href,
      url: i.href
    };
  }
  const { revision: e, url: t } = n;
  if (!t)
    throw new l("add-to-cache-list-unexpected-type", { entry: n });
  if (!e) {
    const i = new URL(t, location.href);
    return {
      cacheKey: i.href,
      url: i.href
    };
  }
  const s = new URL(t, location.href), a = new URL(t, location.href);
  return s.searchParams.set(he, e), {
    cacheKey: s.href,
    url: a.href
  };
}
class ue {
  constructor() {
    this.updatedURLs = [], this.notUpdatedURLs = [], this.handlerWillStart = async ({ request: e, state: t }) => {
      t && (t.originalRequest = e);
    }, this.cachedResponseWillBeUsed = async ({ event: e, state: t, cachedResponse: s }) => {
      if (e.type === "install" && t && t.originalRequest && t.originalRequest instanceof Request) {
        const a = t.originalRequest.url;
        s ? this.notUpdatedURLs.push(a) : this.updatedURLs.push(a);
      }
      return s;
    };
  }
}
class de {
  constructor({ precacheController: e }) {
    this.cacheKeyWillBeUsed = async ({ request: t, params: s }) => {
      const a = (s == null ? void 0 : s.cacheKey) || this._precacheController.getCacheKeyForURL(t.url);
      return a ? new Request(a, { headers: t.headers }) : t;
    }, this._precacheController = e;
  }
}
let E;
function fe() {
  if (E === void 0) {
    const n = new Response("");
    if ("body" in n)
      try {
        new Response(n.body), E = !0;
      } catch {
        E = !1;
      }
    E = !1;
  }
  return E;
}
async function pe(n, e) {
  let t = null;
  if (n.url && (t = new URL(n.url).origin), t !== self.location.origin)
    throw new l("cross-origin-copy-response", { origin: t });
  const s = n.clone(), i = {
    headers: new Headers(s.headers),
    status: s.status,
    statusText: s.statusText
  }, r = fe() ? s.body : await s.blob();
  return new Response(r, i);
}
const me = (n) => new URL(String(n), location.href).href.replace(new RegExp(`^${location.origin}`), "");
function H(n, e) {
  const t = new URL(n);
  for (const s of e)
    t.searchParams.delete(s);
  return t.href;
}
async function ge(n, e, t, s) {
  const a = H(e.url, t);
  if (e.url === a)
    return n.match(e, s);
  const i = Object.assign(Object.assign({}, s), { ignoreSearch: !0 }), r = await n.keys(e, i);
  for (const o of r) {
    const c = H(o.url, t);
    if (a === c)
      return n.match(o, s);
  }
}
class we {
  /**
   * Creates a promise and exposes its resolve and reject functions as methods.
   */
  constructor() {
    this.promise = new Promise((e, t) => {
      this.resolve = e, this.reject = t;
    });
  }
}
const Z = /* @__PURE__ */ new Set();
async function ye() {
  for (const n of Z)
    await n();
}
function Y(n) {
  return new Promise((e) => setTimeout(e, n));
}
try {
  self["workbox:strategies:7.3.0"] && _();
} catch {
}
function P(n) {
  return typeof n == "string" ? new Request(n) : n;
}
class _e {
  /**
   * Creates a new instance associated with the passed strategy and event
   * that's handling the request.
   *
   * The constructor also initializes the state that will be passed to each of
   * the plugins handling this request.
   *
   * @param {workbox-strategies.Strategy} strategy
   * @param {Object} options
   * @param {Request|string} options.request A request to run this strategy for.
   * @param {ExtendableEvent} options.event The event associated with the
   *     request.
   * @param {URL} [options.url]
   * @param {*} [options.params] The return value from the
   *     {@link workbox-routing~matchCallback} (if applicable).
   */
  constructor(e, t) {
    this._cacheKeys = {}, Object.assign(this, t), this.event = t.event, this._strategy = e, this._handlerDeferred = new we(), this._extendLifetimePromises = [], this._plugins = [...e.plugins], this._pluginStateMap = /* @__PURE__ */ new Map();
    for (const s of this._plugins)
      this._pluginStateMap.set(s, {});
    this.event.waitUntil(this._handlerDeferred.promise);
  }
  /**
   * Fetches a given request (and invokes any applicable plugin callback
   * methods) using the `fetchOptions` (for non-navigation requests) and
   * `plugins` defined on the `Strategy` object.
   *
   * The following plugin lifecycle methods are invoked when using this method:
   * - `requestWillFetch()`
   * - `fetchDidSucceed()`
   * - `fetchDidFail()`
   *
   * @param {Request|string} input The URL or request to fetch.
   * @return {Promise<Response>}
   */
  async fetch(e) {
    const { event: t } = this;
    let s = P(e);
    if (s.mode === "navigate" && t instanceof FetchEvent && t.preloadResponse) {
      const r = await t.preloadResponse;
      if (r)
        return r;
    }
    const a = this.hasCallback("fetchDidFail") ? s.clone() : null;
    try {
      for (const r of this.iterateCallbacks("requestWillFetch"))
        s = await r({ request: s.clone(), event: t });
    } catch (r) {
      if (r instanceof Error)
        throw new l("plugin-error-request-will-fetch", {
          thrownErrorMessage: r.message
        });
    }
    const i = s.clone();
    try {
      let r;
      r = await fetch(s, s.mode === "navigate" ? void 0 : this._strategy.fetchOptions);
      for (const o of this.iterateCallbacks("fetchDidSucceed"))
        r = await o({
          event: t,
          request: i,
          response: r
        });
      return r;
    } catch (r) {
      throw a && await this.runCallbacks("fetchDidFail", {
        error: r,
        event: t,
        originalRequest: a.clone(),
        request: i.clone()
      }), r;
    }
  }
  /**
   * Calls `this.fetch()` and (in the background) runs `this.cachePut()` on
   * the response generated by `this.fetch()`.
   *
   * The call to `this.cachePut()` automatically invokes `this.waitUntil()`,
   * so you do not have to manually call `waitUntil()` on the event.
   *
   * @param {Request|string} input The request or URL to fetch and cache.
   * @return {Promise<Response>}
   */
  async fetchAndCachePut(e) {
    const t = await this.fetch(e), s = t.clone();
    return this.waitUntil(this.cachePut(e, s)), t;
  }
  /**
   * Matches a request from the cache (and invokes any applicable plugin
   * callback methods) using the `cacheName`, `matchOptions`, and `plugins`
   * defined on the strategy object.
   *
   * The following plugin lifecycle methods are invoked when using this method:
   * - cacheKeyWillBeUsed()
   * - cachedResponseWillBeUsed()
   *
   * @param {Request|string} key The Request or URL to use as the cache key.
   * @return {Promise<Response|undefined>} A matching response, if found.
   */
  async cacheMatch(e) {
    const t = P(e);
    let s;
    const { cacheName: a, matchOptions: i } = this._strategy, r = await this.getCacheKey(t, "read"), o = Object.assign(Object.assign({}, i), { cacheName: a });
    s = await caches.match(r, o);
    for (const c of this.iterateCallbacks("cachedResponseWillBeUsed"))
      s = await c({
        cacheName: a,
        matchOptions: i,
        cachedResponse: s,
        request: r,
        event: this.event
      }) || void 0;
    return s;
  }
  /**
   * Puts a request/response pair in the cache (and invokes any applicable
   * plugin callback methods) using the `cacheName` and `plugins` defined on
   * the strategy object.
   *
   * The following plugin lifecycle methods are invoked when using this method:
   * - cacheKeyWillBeUsed()
   * - cacheWillUpdate()
   * - cacheDidUpdate()
   *
   * @param {Request|string} key The request or URL to use as the cache key.
   * @param {Response} response The response to cache.
   * @return {Promise<boolean>} `false` if a cacheWillUpdate caused the response
   * not be cached, and `true` otherwise.
   */
  async cachePut(e, t) {
    const s = P(e);
    await Y(0);
    const a = await this.getCacheKey(s, "write");
    if (!t)
      throw new l("cache-put-with-no-response", {
        url: me(a.url)
      });
    const i = await this._ensureResponseSafeToCache(t);
    if (!i)
      return !1;
    const { cacheName: r, matchOptions: o } = this._strategy, c = await self.caches.open(r), h = this.hasCallback("cacheDidUpdate"), R = h ? await ge(
      // TODO(philipwalton): the `__WB_REVISION__` param is a precaching
      // feature. Consider into ways to only add this behavior if using
      // precaching.
      c,
      a.clone(),
      ["__WB_REVISION__"],
      o
    ) : null;
    try {
      await c.put(a, h ? i.clone() : i);
    } catch (u) {
      if (u instanceof Error)
        throw u.name === "QuotaExceededError" && await ye(), u;
    }
    for (const u of this.iterateCallbacks("cacheDidUpdate"))
      await u({
        cacheName: r,
        oldResponse: R,
        newResponse: i.clone(),
        request: a,
        event: this.event
      });
    return !0;
  }
  /**
   * Checks the list of plugins for the `cacheKeyWillBeUsed` callback, and
   * executes any of those callbacks found in sequence. The final `Request`
   * object returned by the last plugin is treated as the cache key for cache
   * reads and/or writes. If no `cacheKeyWillBeUsed` plugin callbacks have
   * been registered, the passed request is returned unmodified
   *
   * @param {Request} request
   * @param {string} mode
   * @return {Promise<Request>}
   */
  async getCacheKey(e, t) {
    const s = `${e.url} | ${t}`;
    if (!this._cacheKeys[s]) {
      let a = e;
      for (const i of this.iterateCallbacks("cacheKeyWillBeUsed"))
        a = P(await i({
          mode: t,
          request: a,
          event: this.event,
          // params has a type any can't change right now.
          params: this.params
          // eslint-disable-line
        }));
      this._cacheKeys[s] = a;
    }
    return this._cacheKeys[s];
  }
  /**
   * Returns true if the strategy has at least one plugin with the given
   * callback.
   *
   * @param {string} name The name of the callback to check for.
   * @return {boolean}
   */
  hasCallback(e) {
    for (const t of this._strategy.plugins)
      if (e in t)
        return !0;
    return !1;
  }
  /**
   * Runs all plugin callbacks matching the given name, in order, passing the
   * given param object (merged ith the current plugin state) as the only
   * argument.
   *
   * Note: since this method runs all plugins, it's not suitable for cases
   * where the return value of a callback needs to be applied prior to calling
   * the next callback. See
   * {@link workbox-strategies.StrategyHandler#iterateCallbacks}
   * below for how to handle that case.
   *
   * @param {string} name The name of the callback to run within each plugin.
   * @param {Object} param The object to pass as the first (and only) param
   *     when executing each callback. This object will be merged with the
   *     current plugin state prior to callback execution.
   */
  async runCallbacks(e, t) {
    for (const s of this.iterateCallbacks(e))
      await s(t);
  }
  /**
   * Accepts a callback and returns an iterable of matching plugin callbacks,
   * where each callback is wrapped with the current handler state (i.e. when
   * you call each callback, whatever object parameter you pass it will
   * be merged with the plugin's current state).
   *
   * @param {string} name The name fo the callback to run
   * @return {Array<Function>}
   */
  *iterateCallbacks(e) {
    for (const t of this._strategy.plugins)
      if (typeof t[e] == "function") {
        const s = this._pluginStateMap.get(t);
        yield (i) => {
          const r = Object.assign(Object.assign({}, i), { state: s });
          return t[e](r);
        };
      }
  }
  /**
   * Adds a promise to the
   * [extend lifetime promises]{@link https://w3c.github.io/ServiceWorker/#extendableevent-extend-lifetime-promises}
   * of the event associated with the request being handled (usually a
   * `FetchEvent`).
   *
   * Note: you can await
   * {@link workbox-strategies.StrategyHandler~doneWaiting}
   * to know when all added promises have settled.
   *
   * @param {Promise} promise A promise to add to the extend lifetime promises
   *     of the event that triggered the request.
   */
  waitUntil(e) {
    return this._extendLifetimePromises.push(e), e;
  }
  /**
   * Returns a promise that resolves once all promises passed to
   * {@link workbox-strategies.StrategyHandler~waitUntil}
   * have settled.
   *
   * Note: any work done after `doneWaiting()` settles should be manually
   * passed to an event's `waitUntil()` method (not this handler's
   * `waitUntil()` method), otherwise the service worker thread may be killed
   * prior to your work completing.
   */
  async doneWaiting() {
    for (; this._extendLifetimePromises.length; ) {
      const e = this._extendLifetimePromises.splice(0), s = (await Promise.allSettled(e)).find((a) => a.status === "rejected");
      if (s)
        throw s.reason;
    }
  }
  /**
   * Stops running the strategy and immediately resolves any pending
   * `waitUntil()` promises.
   */
  destroy() {
    this._handlerDeferred.resolve(null);
  }
  /**
   * This method will call cacheWillUpdate on the available plugins (or use
   * status === 200) to determine if the Response is safe and valid to cache.
   *
   * @param {Request} options.request
   * @param {Response} options.response
   * @return {Promise<Response|undefined>}
   *
   * @private
   */
  async _ensureResponseSafeToCache(e) {
    let t = e, s = !1;
    for (const a of this.iterateCallbacks("cacheWillUpdate"))
      if (t = await a({
        request: this.request,
        response: t,
        event: this.event
      }) || void 0, s = !0, !t)
        break;
    return s || t && t.status !== 200 && (t = void 0), t;
  }
}
class N {
  /**
   * Creates a new instance of the strategy and sets all documented option
   * properties as public instance properties.
   *
   * Note: if a custom strategy class extends the base Strategy class and does
   * not need more than these properties, it does not need to define its own
   * constructor.
   *
   * @param {Object} [options]
   * @param {string} [options.cacheName] Cache name to store and retrieve
   * requests. Defaults to the cache names provided by
   * {@link workbox-core.cacheNames}.
   * @param {Array<Object>} [options.plugins] [Plugins]{@link https://developers.google.com/web/tools/workbox/guides/using-plugins}
   * to use in conjunction with this caching strategy.
   * @param {Object} [options.fetchOptions] Values passed along to the
   * [`init`](https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/fetch#Parameters)
   * of [non-navigation](https://github.com/GoogleChrome/workbox/issues/1796)
   * `fetch()` requests made by this strategy.
   * @param {Object} [options.matchOptions] The
   * [`CacheQueryOptions`]{@link https://w3c.github.io/ServiceWorker/#dictdef-cachequeryoptions}
   * for any `cache.match()` or `cache.put()` calls made by this strategy.
   */
  constructor(e = {}) {
    this.cacheName = T.getRuntimeName(e.cacheName), this.plugins = e.plugins || [], this.fetchOptions = e.fetchOptions, this.matchOptions = e.matchOptions;
  }
  /**
   * Perform a request strategy and returns a `Promise` that will resolve with
   * a `Response`, invoking all relevant plugin callbacks.
   *
   * When a strategy instance is registered with a Workbox
   * {@link workbox-routing.Route}, this method is automatically
   * called when the route matches.
   *
   * Alternatively, this method can be used in a standalone `FetchEvent`
   * listener by passing it to `event.respondWith()`.
   *
   * @param {FetchEvent|Object} options A `FetchEvent` or an object with the
   *     properties listed below.
   * @param {Request|string} options.request A request to run this strategy for.
   * @param {ExtendableEvent} options.event The event associated with the
   *     request.
   * @param {URL} [options.url]
   * @param {*} [options.params]
   */
  handle(e) {
    const [t] = this.handleAll(e);
    return t;
  }
  /**
   * Similar to {@link workbox-strategies.Strategy~handle}, but
   * instead of just returning a `Promise` that resolves to a `Response` it
   * it will return an tuple of `[response, done]` promises, where the former
   * (`response`) is equivalent to what `handle()` returns, and the latter is a
   * Promise that will resolve once any promises that were added to
   * `event.waitUntil()` as part of performing the strategy have completed.
   *
   * You can await the `done` promise to ensure any extra work performed by
   * the strategy (usually caching responses) completes successfully.
   *
   * @param {FetchEvent|Object} options A `FetchEvent` or an object with the
   *     properties listed below.
   * @param {Request|string} options.request A request to run this strategy for.
   * @param {ExtendableEvent} options.event The event associated with the
   *     request.
   * @param {URL} [options.url]
   * @param {*} [options.params]
   * @return {Array<Promise>} A tuple of [response, done]
   *     promises that can be used to determine when the response resolves as
   *     well as when the handler has completed all its work.
   */
  handleAll(e) {
    e instanceof FetchEvent && (e = {
      event: e,
      request: e.request
    });
    const t = e.event, s = typeof e.request == "string" ? new Request(e.request) : e.request, a = "params" in e ? e.params : void 0, i = new _e(this, { event: t, request: s, params: a }), r = this._getResponse(i, s, t), o = this._awaitComplete(r, i, s, t);
    return [r, o];
  }
  async _getResponse(e, t, s) {
    await e.runCallbacks("handlerWillStart", { event: s, request: t });
    let a;
    try {
      if (a = await this._handle(t, e), !a || a.type === "error")
        throw new l("no-response", { url: t.url });
    } catch (i) {
      if (i instanceof Error) {
        for (const r of e.iterateCallbacks("handlerDidError"))
          if (a = await r({ error: i, event: s, request: t }), a)
            break;
      }
      if (!a)
        throw i;
    }
    for (const i of e.iterateCallbacks("handlerWillRespond"))
      a = await i({ event: s, request: t, response: a });
    return a;
  }
  async _awaitComplete(e, t, s, a) {
    let i, r;
    try {
      i = await e;
    } catch {
    }
    try {
      await t.runCallbacks("handlerDidRespond", {
        event: a,
        request: s,
        response: i
      }), await t.doneWaiting();
    } catch (o) {
      o instanceof Error && (r = o);
    }
    if (await t.runCallbacks("handlerDidComplete", {
      event: a,
      request: s,
      response: i,
      error: r
    }), t.destroy(), r)
      throw r;
  }
}
class g extends N {
  /**
   *
   * @param {Object} [options]
   * @param {string} [options.cacheName] Cache name to store and retrieve
   * requests. Defaults to the cache names provided by
   * {@link workbox-core.cacheNames}.
   * @param {Array<Object>} [options.plugins] {@link https://developers.google.com/web/tools/workbox/guides/using-plugins|Plugins}
   * to use in conjunction with this caching strategy.
   * @param {Object} [options.fetchOptions] Values passed along to the
   * {@link https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/fetch#Parameters|init}
   * of all fetch() requests made by this strategy.
   * @param {Object} [options.matchOptions] The
   * {@link https://w3c.github.io/ServiceWorker/#dictdef-cachequeryoptions|CacheQueryOptions}
   * for any `cache.match()` or `cache.put()` calls made by this strategy.
   * @param {boolean} [options.fallbackToNetwork=true] Whether to attempt to
   * get the response from the network if there's a precache miss.
   */
  constructor(e = {}) {
    e.cacheName = T.getPrecacheName(e.cacheName), super(e), this._fallbackToNetwork = e.fallbackToNetwork !== !1, this.plugins.push(g.copyRedirectedCacheableResponsesPlugin);
  }
  /**
   * @private
   * @param {Request|string} request A request to run this strategy for.
   * @param {workbox-strategies.StrategyHandler} handler The event that
   *     triggered the request.
   * @return {Promise<Response>}
   */
  async _handle(e, t) {
    const s = await t.cacheMatch(e);
    return s || (t.event && t.event.type === "install" ? await this._handleInstall(e, t) : await this._handleFetch(e, t));
  }
  async _handleFetch(e, t) {
    let s;
    const a = t.params || {};
    if (this._fallbackToNetwork) {
      const i = a.integrity, r = e.integrity, o = !r || r === i;
      s = await t.fetch(new Request(e, {
        integrity: e.mode !== "no-cors" ? r || i : void 0
      })), i && o && e.mode !== "no-cors" && (this._useDefaultCacheabilityPluginIfNeeded(), await t.cachePut(e, s.clone()));
    } else
      throw new l("missing-precache-entry", {
        cacheName: this.cacheName,
        url: e.url
      });
    return s;
  }
  async _handleInstall(e, t) {
    this._useDefaultCacheabilityPluginIfNeeded();
    const s = await t.fetch(e);
    if (!await t.cachePut(e, s.clone()))
      throw new l("bad-precaching-response", {
        url: e.url,
        status: s.status
      });
    return s;
  }
  /**
   * This method is complex, as there a number of things to account for:
   *
   * The `plugins` array can be set at construction, and/or it might be added to
   * to at any time before the strategy is used.
   *
   * At the time the strategy is used (i.e. during an `install` event), there
   * needs to be at least one plugin that implements `cacheWillUpdate` in the
   * array, other than `copyRedirectedCacheableResponsesPlugin`.
   *
   * - If this method is called and there are no suitable `cacheWillUpdate`
   * plugins, we need to add `defaultPrecacheCacheabilityPlugin`.
   *
   * - If this method is called and there is exactly one `cacheWillUpdate`, then
   * we don't have to do anything (this might be a previously added
   * `defaultPrecacheCacheabilityPlugin`, or it might be a custom plugin).
   *
   * - If this method is called and there is more than one `cacheWillUpdate`,
   * then we need to check if one is `defaultPrecacheCacheabilityPlugin`. If so,
   * we need to remove it. (This situation is unlikely, but it could happen if
   * the strategy is used multiple times, the first without a `cacheWillUpdate`,
   * and then later on after manually adding a custom `cacheWillUpdate`.)
   *
   * See https://github.com/GoogleChrome/workbox/issues/2737 for more context.
   *
   * @private
   */
  _useDefaultCacheabilityPluginIfNeeded() {
    let e = null, t = 0;
    for (const [s, a] of this.plugins.entries())
      a !== g.copyRedirectedCacheableResponsesPlugin && (a === g.defaultPrecacheCacheabilityPlugin && (e = s), a.cacheWillUpdate && t++);
    t === 0 ? this.plugins.push(g.defaultPrecacheCacheabilityPlugin) : t > 1 && e !== null && this.plugins.splice(e, 1);
  }
}
g.defaultPrecacheCacheabilityPlugin = {
  async cacheWillUpdate({ response: n }) {
    return !n || n.status >= 400 ? null : n;
  }
};
g.copyRedirectedCacheableResponsesPlugin = {
  async cacheWillUpdate({ response: n }) {
    return n.redirected ? await pe(n) : n;
  }
};
class be {
  /**
   * Create a new PrecacheController.
   *
   * @param {Object} [options]
   * @param {string} [options.cacheName] The cache to use for precaching.
   * @param {string} [options.plugins] Plugins to use when precaching as well
   * as responding to fetch events for precached assets.
   * @param {boolean} [options.fallbackToNetwork=true] Whether to attempt to
   * get the response from the network if there's a precache miss.
   */
  constructor({ cacheName: e, plugins: t = [], fallbackToNetwork: s = !0 } = {}) {
    this._urlsToCacheKeys = /* @__PURE__ */ new Map(), this._urlsToCacheModes = /* @__PURE__ */ new Map(), this._cacheKeysToIntegrities = /* @__PURE__ */ new Map(), this._strategy = new g({
      cacheName: T.getPrecacheName(e),
      plugins: [
        ...t,
        new de({ precacheController: this })
      ],
      fallbackToNetwork: s
    }), this.install = this.install.bind(this), this.activate = this.activate.bind(this);
  }
  /**
   * @type {workbox-precaching.PrecacheStrategy} The strategy created by this controller and
   * used to cache assets and respond to fetch events.
   */
  get strategy() {
    return this._strategy;
  }
  /**
   * Adds items to the precache list, removing any duplicates and
   * stores the files in the
   * {@link workbox-core.cacheNames|"precache cache"} when the service
   * worker installs.
   *
   * This method can be called multiple times.
   *
   * @param {Array<Object|string>} [entries=[]] Array of entries to precache.
   */
  precache(e) {
    this.addToCacheList(e), this._installAndActiveListenersAdded || (self.addEventListener("install", this.install), self.addEventListener("activate", this.activate), this._installAndActiveListenersAdded = !0);
  }
  /**
   * This method will add items to the precache list, removing duplicates
   * and ensuring the information is valid.
   *
   * @param {Array<workbox-precaching.PrecacheController.PrecacheEntry|string>} entries
   *     Array of entries to precache.
   */
  addToCacheList(e) {
    const t = [];
    for (const s of e) {
      typeof s == "string" ? t.push(s) : s && s.revision === void 0 && t.push(s.url);
      const { cacheKey: a, url: i } = le(s), r = typeof s != "string" && s.revision ? "reload" : "default";
      if (this._urlsToCacheKeys.has(i) && this._urlsToCacheKeys.get(i) !== a)
        throw new l("add-to-cache-list-conflicting-entries", {
          firstEntry: this._urlsToCacheKeys.get(i),
          secondEntry: a
        });
      if (typeof s != "string" && s.integrity) {
        if (this._cacheKeysToIntegrities.has(a) && this._cacheKeysToIntegrities.get(a) !== s.integrity)
          throw new l("add-to-cache-list-conflicting-integrities", {
            url: i
          });
        this._cacheKeysToIntegrities.set(a, s.integrity);
      }
      if (this._urlsToCacheKeys.set(i, a), this._urlsToCacheModes.set(i, r), t.length > 0) {
        const o = `Workbox is precaching URLs without revision info: ${t.join(", ")}
This is generally NOT safe. Learn more at https://bit.ly/wb-precache`;
        console.warn(o);
      }
    }
  }
  /**
   * Precaches new and updated assets. Call this method from the service worker
   * install event.
   *
   * Note: this method calls `event.waitUntil()` for you, so you do not need
   * to call it yourself in your event handlers.
   *
   * @param {ExtendableEvent} event
   * @return {Promise<workbox-precaching.InstallResult>}
   */
  install(e) {
    return F(e, async () => {
      const t = new ue();
      this.strategy.plugins.push(t);
      for (const [i, r] of this._urlsToCacheKeys) {
        const o = this._cacheKeysToIntegrities.get(r), c = this._urlsToCacheModes.get(i), h = new Request(i, {
          integrity: o,
          cache: c,
          credentials: "same-origin"
        });
        await Promise.all(this.strategy.handleAll({
          params: { cacheKey: r },
          request: h,
          event: e
        }));
      }
      const { updatedURLs: s, notUpdatedURLs: a } = t;
      return { updatedURLs: s, notUpdatedURLs: a };
    });
  }
  /**
   * Deletes assets that are no longer present in the current precache manifest.
   * Call this method from the service worker activate event.
   *
   * Note: this method calls `event.waitUntil()` for you, so you do not need
   * to call it yourself in your event handlers.
   *
   * @param {ExtendableEvent} event
   * @return {Promise<workbox-precaching.CleanupResult>}
   */
  activate(e) {
    return F(e, async () => {
      const t = await self.caches.open(this.strategy.cacheName), s = await t.keys(), a = new Set(this._urlsToCacheKeys.values()), i = [];
      for (const r of s)
        a.has(r.url) || (await t.delete(r), i.push(r.url));
      return { deletedURLs: i };
    });
  }
  /**
   * Returns a mapping of a precached URL to the corresponding cache key, taking
   * into account the revision information for the URL.
   *
   * @return {Map<string, string>} A URL to cache key mapping.
   */
  getURLsToCacheKeys() {
    return this._urlsToCacheKeys;
  }
  /**
   * Returns a list of all the URLs that have been precached by the current
   * service worker.
   *
   * @return {Array<string>} The precached URLs.
   */
  getCachedURLs() {
    return [...this._urlsToCacheKeys.keys()];
  }
  /**
   * Returns the cache key used for storing a given URL. If that URL is
   * unversioned, like `/index.html', then the cache key will be the original
   * URL with a search parameter appended to it.
   *
   * @param {string} url A URL whose cache key you want to look up.
   * @return {string} The versioned URL that corresponds to a cache key
   * for the original URL, or undefined if that URL isn't precached.
   */
  getCacheKeyForURL(e) {
    const t = new URL(e, location.href);
    return this._urlsToCacheKeys.get(t.href);
  }
  /**
   * @param {string} url A cache key whose SRI you want to look up.
   * @return {string} The subresource integrity associated with the cache key,
   * or undefined if it's not set.
   */
  getIntegrityForCacheKey(e) {
    return this._cacheKeysToIntegrities.get(e);
  }
  /**
   * This acts as a drop-in replacement for
   * [`cache.match()`](https://developer.mozilla.org/en-US/docs/Web/API/Cache/match)
   * with the following differences:
   *
   * - It knows what the name of the precache is, and only checks in that cache.
   * - It allows you to pass in an "original" URL without versioning parameters,
   * and it will automatically look up the correct cache key for the currently
   * active revision of that URL.
   *
   * E.g., `matchPrecache('index.html')` will find the correct precached
   * response for the currently active service worker, even if the actual cache
   * key is `'/index.html?__WB_REVISION__=1234abcd'`.
   *
   * @param {string|Request} request The key (without revisioning parameters)
   * to look up in the precache.
   * @return {Promise<Response|undefined>}
   */
  async matchPrecache(e) {
    const t = e instanceof Request ? e.url : e, s = this.getCacheKeyForURL(t);
    if (s)
      return (await self.caches.open(this.strategy.cacheName)).match(s);
  }
  /**
   * Returns a function that looks up `url` in the precache (taking into
   * account revision information), and returns the corresponding `Response`.
   *
   * @param {string} url The precached URL which will be used to lookup the
   * `Response`.
   * @return {workbox-routing~handlerCallback}
   */
  createHandlerBoundToURL(e) {
    const t = this.getCacheKeyForURL(e);
    if (!t)
      throw new l("non-precached-url", { url: e });
    return (s) => (s.request = new Request(e), s.params = Object.assign({ cacheKey: t }, s.params), this.strategy.handle(s));
  }
}
let v;
const B = () => (v || (v = new be()), v);
try {
  self["workbox:routing:7.3.0"] && _();
} catch {
}
const ee = "GET", U = (n) => n && typeof n == "object" ? n : { handle: n };
class y {
  /**
   * Constructor for Route class.
   *
   * @param {workbox-routing~matchCallback} match
   * A callback function that determines whether the route matches a given
   * `fetch` event by returning a non-falsy value.
   * @param {workbox-routing~handlerCallback} handler A callback
   * function that returns a Promise resolving to a Response.
   * @param {string} [method='GET'] The HTTP method to match the Route
   * against.
   */
  constructor(e, t, s = ee) {
    this.handler = U(t), this.match = e, this.method = s;
  }
  /**
   *
   * @param {workbox-routing-handlerCallback} handler A callback
   * function that returns a Promise resolving to a Response
   */
  setCatchHandler(e) {
    this.catchHandler = U(e);
  }
}
class Re extends y {
  /**
   * If the regular expression contains
   * [capture groups]{@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp#grouping-back-references},
   * the captured values will be passed to the
   * {@link workbox-routing~handlerCallback} `params`
   * argument.
   *
   * @param {RegExp} regExp The regular expression to match against URLs.
   * @param {workbox-routing~handlerCallback} handler A callback
   * function that returns a Promise resulting in a Response.
   * @param {string} [method='GET'] The HTTP method to match the Route
   * against.
   */
  constructor(e, t, s) {
    const a = ({ url: i }) => {
      const r = e.exec(i.href);
      if (r && !(i.origin !== location.origin && r.index !== 0))
        return r.slice(1);
    };
    super(a, t, s);
  }
}
class Ee {
  /**
   * Initializes a new Router.
   */
  constructor() {
    this._routes = /* @__PURE__ */ new Map(), this._defaultHandlerMap = /* @__PURE__ */ new Map();
  }
  /**
   * @return {Map<string, Array<workbox-routing.Route>>} routes A `Map` of HTTP
   * method name ('GET', etc.) to an array of all the corresponding `Route`
   * instances that are registered.
   */
  get routes() {
    return this._routes;
  }
  /**
   * Adds a fetch event listener to respond to events when a route matches
   * the event's request.
   */
  addFetchListener() {
    self.addEventListener("fetch", (e) => {
      const { request: t } = e, s = this.handleRequest({ request: t, event: e });
      s && e.respondWith(s);
    });
  }
  /**
   * Adds a message event listener for URLs to cache from the window.
   * This is useful to cache resources loaded on the page prior to when the
   * service worker started controlling it.
   *
   * The format of the message data sent from the window should be as follows.
   * Where the `urlsToCache` array may consist of URL strings or an array of
   * URL string + `requestInit` object (the same as you'd pass to `fetch()`).
   *
   * ```
   * {
   *   type: 'CACHE_URLS',
   *   payload: {
   *     urlsToCache: [
   *       './script1.js',
   *       './script2.js',
   *       ['./script3.js', {mode: 'no-cors'}],
   *     ],
   *   },
   * }
   * ```
   */
  addCacheListener() {
    self.addEventListener("message", (e) => {
      if (e.data && e.data.type === "CACHE_URLS") {
        const { payload: t } = e.data, s = Promise.all(t.urlsToCache.map((a) => {
          typeof a == "string" && (a = [a]);
          const i = new Request(...a);
          return this.handleRequest({ request: i, event: e });
        }));
        e.waitUntil(s), e.ports && e.ports[0] && s.then(() => e.ports[0].postMessage(!0));
      }
    });
  }
  /**
   * Apply the routing rules to a FetchEvent object to get a Response from an
   * appropriate Route's handler.
   *
   * @param {Object} options
   * @param {Request} options.request The request to handle.
   * @param {ExtendableEvent} options.event The event that triggered the
   *     request.
   * @return {Promise<Response>|undefined} A promise is returned if a
   *     registered route can handle the request. If there is no matching
   *     route and there's no `defaultHandler`, `undefined` is returned.
   */
  handleRequest({ request: e, event: t }) {
    const s = new URL(e.url, location.href);
    if (!s.protocol.startsWith("http"))
      return;
    const a = s.origin === location.origin, { params: i, route: r } = this.findMatchingRoute({
      event: t,
      request: e,
      sameOrigin: a,
      url: s
    });
    let o = r && r.handler;
    const c = e.method;
    if (!o && this._defaultHandlerMap.has(c) && (o = this._defaultHandlerMap.get(c)), !o)
      return;
    let h;
    try {
      h = o.handle({ url: s, request: e, event: t, params: i });
    } catch (u) {
      h = Promise.reject(u);
    }
    const R = r && r.catchHandler;
    return h instanceof Promise && (this._catchHandler || R) && (h = h.catch(async (u) => {
      if (R)
        try {
          return await R.handle({ url: s, request: e, event: t, params: i });
        } catch (j) {
          j instanceof Error && (u = j);
        }
      if (this._catchHandler)
        return this._catchHandler.handle({ url: s, request: e, event: t });
      throw u;
    })), h;
  }
  /**
   * Checks a request and URL (and optionally an event) against the list of
   * registered routes, and if there's a match, returns the corresponding
   * route along with any params generated by the match.
   *
   * @param {Object} options
   * @param {URL} options.url
   * @param {boolean} options.sameOrigin The result of comparing `url.origin`
   *     against the current origin.
   * @param {Request} options.request The request to match.
   * @param {Event} options.event The corresponding event.
   * @return {Object} An object with `route` and `params` properties.
   *     They are populated if a matching route was found or `undefined`
   *     otherwise.
   */
  findMatchingRoute({ url: e, sameOrigin: t, request: s, event: a }) {
    const i = this._routes.get(s.method) || [];
    for (const r of i) {
      let o;
      const c = r.match({ url: e, sameOrigin: t, request: s, event: a });
      if (c)
        return o = c, (Array.isArray(o) && o.length === 0 || c.constructor === Object && // eslint-disable-line
        Object.keys(c).length === 0 || typeof c == "boolean") && (o = void 0), { route: r, params: o };
    }
    return {};
  }
  /**
   * Define a default `handler` that's called when no routes explicitly
   * match the incoming request.
   *
   * Each HTTP method ('GET', 'POST', etc.) gets its own default handler.
   *
   * Without a default handler, unmatched requests will go against the
   * network as if there were no service worker present.
   *
   * @param {workbox-routing~handlerCallback} handler A callback
   * function that returns a Promise resulting in a Response.
   * @param {string} [method='GET'] The HTTP method to associate with this
   * default handler. Each method has its own default.
   */
  setDefaultHandler(e, t = ee) {
    this._defaultHandlerMap.set(t, U(e));
  }
  /**
   * If a Route throws an error while handling a request, this `handler`
   * will be called and given a chance to provide a response.
   *
   * @param {workbox-routing~handlerCallback} handler A callback
   * function that returns a Promise resulting in a Response.
   */
  setCatchHandler(e) {
    this._catchHandler = U(e);
  }
  /**
   * Registers a route with the router.
   *
   * @param {workbox-routing.Route} route The route to register.
   */
  registerRoute(e) {
    this._routes.has(e.method) || this._routes.set(e.method, []), this._routes.get(e.method).push(e);
  }
  /**
   * Unregisters a route with the router.
   *
   * @param {workbox-routing.Route} route The route to unregister.
   */
  unregisterRoute(e) {
    if (!this._routes.has(e.method))
      throw new l("unregister-route-but-not-found-with-method", {
        method: e.method
      });
    const t = this._routes.get(e.method).indexOf(e);
    if (t > -1)
      this._routes.get(e.method).splice(t, 1);
    else
      throw new l("unregister-route-route-not-registered");
  }
}
let C;
const Ce = () => (C || (C = new Ee(), C.addFetchListener(), C.addCacheListener()), C);
function d(n, e, t) {
  let s;
  if (typeof n == "string") {
    const i = new URL(n, location.href), r = ({ url: o }) => o.href === i.href;
    s = new y(r, e, t);
  } else if (n instanceof RegExp)
    s = new Re(n, e, t);
  else if (typeof n == "function")
    s = new y(n, e, t);
  else if (n instanceof y)
    s = n;
  else
    throw new l("unsupported-route-type", {
      moduleName: "workbox-routing",
      funcName: "registerRoute",
      paramName: "capture"
    });
  return Ce().registerRoute(s), s;
}
function xe(n, e = []) {
  for (const t of [...n.searchParams.keys()])
    e.some((s) => s.test(t)) && n.searchParams.delete(t);
  return n;
}
function* De(n, { ignoreURLParametersMatching: e = [/^utm_/, /^fbclid$/], directoryIndex: t = "index.html", cleanURLs: s = !0, urlManipulation: a } = {}) {
  const i = new URL(n, location.href);
  i.hash = "", yield i.href;
  const r = xe(i, e);
  if (yield r.href, t && r.pathname.endsWith("/")) {
    const o = new URL(r.href);
    o.pathname += t, yield o.href;
  }
  if (s) {
    const o = new URL(r.href);
    o.pathname += ".html", yield o.href;
  }
  if (a) {
    const o = a({ url: i });
    for (const c of o)
      yield c.href;
  }
}
class ke extends y {
  /**
   * @param {PrecacheController} precacheController A `PrecacheController`
   * instance used to both match requests and respond to fetch events.
   * @param {Object} [options] Options to control how requests are matched
   * against the list of precached URLs.
   * @param {string} [options.directoryIndex=index.html] The `directoryIndex` will
   * check cache entries for a URLs ending with '/' to see if there is a hit when
   * appending the `directoryIndex` value.
   * @param {Array<RegExp>} [options.ignoreURLParametersMatching=[/^utm_/, /^fbclid$/]] An
   * array of regex's to remove search params when looking for a cache match.
   * @param {boolean} [options.cleanURLs=true] The `cleanURLs` option will
   * check the cache for the URL with a `.html` added to the end of the end.
   * @param {workbox-precaching~urlManipulation} [options.urlManipulation]
   * This is a function that should take a URL and return an array of
   * alternative URLs that should be checked for precache matches.
   */
  constructor(e, t) {
    const s = ({ request: a }) => {
      const i = e.getURLsToCacheKeys();
      for (const r of De(a.url, t)) {
        const o = i.get(r);
        if (o) {
          const c = e.getIntegrityForCacheKey(o);
          return { cacheKey: o, integrity: c };
        }
      }
    };
    super(s, e.strategy);
  }
}
function Te(n) {
  const e = B(), t = new ke(e, n);
  d(t);
}
const Ne = "-precache-", Se = async (n, e = Ne) => {
  const s = (await self.caches.keys()).filter((a) => a.includes(e) && a.includes(self.registration.scope) && a !== n);
  return await Promise.all(s.map((a) => self.caches.delete(a))), s;
};
function Pe() {
  self.addEventListener("activate", (n) => {
    const e = T.getPrecacheName();
    n.waitUntil(Se(e).then((t) => {
    }));
  });
}
function Ue(n) {
  return B().createHandlerBoundToURL(n);
}
function Le(n) {
  B().precache(n);
}
function ve(n, e) {
  Le(n), Te(e);
}
class Ie extends y {
  /**
   * If both `denylist` and `allowlist` are provided, the `denylist` will
   * take precedence and the request will not match this route.
   *
   * The regular expressions in `allowlist` and `denylist`
   * are matched against the concatenated
   * [`pathname`]{@link https://developer.mozilla.org/en-US/docs/Web/API/HTMLHyperlinkElementUtils/pathname}
   * and [`search`]{@link https://developer.mozilla.org/en-US/docs/Web/API/HTMLHyperlinkElementUtils/search}
   * portions of the requested URL.
   *
   * *Note*: These RegExps may be evaluated against every destination URL during
   * a navigation. Avoid using
   * [complex RegExps](https://github.com/GoogleChrome/workbox/issues/3077),
   * or else your users may see delays when navigating your site.
   *
   * @param {workbox-routing~handlerCallback} handler A callback
   * function that returns a Promise resulting in a Response.
   * @param {Object} options
   * @param {Array<RegExp>} [options.denylist] If any of these patterns match,
   * the route will not handle the request (even if a allowlist RegExp matches).
   * @param {Array<RegExp>} [options.allowlist=[/./]] If any of these patterns
   * match the URL's pathname and search parameter, the route will handle the
   * request (assuming the denylist doesn't match).
   */
  constructor(e, { allowlist: t = [/./], denylist: s = [] } = {}) {
    super((a) => this._match(a), e), this._allowlist = t, this._denylist = s;
  }
  /**
   * Routes match handler.
   *
   * @param {Object} options
   * @param {URL} options.url
   * @param {Request} options.request
   * @return {boolean}
   *
   * @private
   */
  _match({ url: e, request: t }) {
    if (t && t.mode !== "navigate")
      return !1;
    const s = e.pathname + e.search;
    for (const a of this._denylist)
      if (a.test(s))
        return !1;
    return !!this._allowlist.some((a) => a.test(s));
  }
}
class S extends N {
  /**
   * @private
   * @param {Request|string} request A request to run this strategy for.
   * @param {workbox-strategies.StrategyHandler} handler The event that
   *     triggered the request.
   * @return {Promise<Response>}
   */
  async _handle(e, t) {
    let s = await t.cacheMatch(e), a;
    if (!s)
      try {
        s = await t.fetchAndCachePut(e);
      } catch (i) {
        i instanceof Error && (a = i);
      }
    if (!s)
      throw new l("no-response", { url: e.url, error: a });
    return s;
  }
}
const te = {
  /**
   * Returns a valid response (to allow caching) if the status is 200 (OK) or
   * 0 (opaque).
   *
   * @param {Object} options
   * @param {Response} options.response
   * @return {Response|null}
   *
   * @private
   */
  cacheWillUpdate: async ({ response: n }) => n.status === 200 || n.status === 0 ? n : null
};
class qe extends N {
  /**
   * @param {Object} [options]
   * @param {string} [options.cacheName] Cache name to store and retrieve
   * requests. Defaults to cache names provided by
   * {@link workbox-core.cacheNames}.
   * @param {Array<Object>} [options.plugins] [Plugins]{@link https://developers.google.com/web/tools/workbox/guides/using-plugins}
   * to use in conjunction with this caching strategy.
   * @param {Object} [options.fetchOptions] Values passed along to the
   * [`init`](https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/fetch#Parameters)
   * of [non-navigation](https://github.com/GoogleChrome/workbox/issues/1796)
   * `fetch()` requests made by this strategy.
   * @param {Object} [options.matchOptions] [`CacheQueryOptions`](https://w3c.github.io/ServiceWorker/#dictdef-cachequeryoptions)
   * @param {number} [options.networkTimeoutSeconds] If set, any network requests
   * that fail to respond within the timeout will fallback to the cache.
   *
   * This option can be used to combat
   * "[lie-fi]{@link https://developers.google.com/web/fundamentals/performance/poor-connectivity/#lie-fi}"
   * scenarios.
   */
  constructor(e = {}) {
    super(e), this.plugins.some((t) => "cacheWillUpdate" in t) || this.plugins.unshift(te), this._networkTimeoutSeconds = e.networkTimeoutSeconds || 0;
  }
  /**
   * @private
   * @param {Request|string} request A request to run this strategy for.
   * @param {workbox-strategies.StrategyHandler} handler The event that
   *     triggered the request.
   * @return {Promise<Response>}
   */
  async _handle(e, t) {
    const s = [], a = [];
    let i;
    if (this._networkTimeoutSeconds) {
      const { id: c, promise: h } = this._getTimeoutPromise({ request: e, logs: s, handler: t });
      i = c, a.push(h);
    }
    const r = this._getNetworkPromise({
      timeoutId: i,
      request: e,
      logs: s,
      handler: t
    });
    a.push(r);
    const o = await t.waitUntil((async () => await t.waitUntil(Promise.race(a)) || // If Promise.race() resolved with null, it might be due to a network
    // timeout + a cache miss. If that were to happen, we'd rather wait until
    // the networkPromise resolves instead of returning null.
    // Note that it's fine to await an already-resolved promise, so we don't
    // have to check to see if it's still "in flight".
    await r)());
    if (!o)
      throw new l("no-response", { url: e.url });
    return o;
  }
  /**
   * @param {Object} options
   * @param {Request} options.request
   * @param {Array} options.logs A reference to the logs array
   * @param {Event} options.event
   * @return {Promise<Response>}
   *
   * @private
   */
  _getTimeoutPromise({ request: e, logs: t, handler: s }) {
    let a;
    return {
      promise: new Promise((r) => {
        a = setTimeout(async () => {
          r(await s.cacheMatch(e));
        }, this._networkTimeoutSeconds * 1e3);
      }),
      id: a
    };
  }
  /**
   * @param {Object} options
   * @param {number|undefined} options.timeoutId
   * @param {Request} options.request
   * @param {Array} options.logs A reference to the logs Array.
   * @param {Event} options.event
   * @return {Promise<Response>}
   *
   * @private
   */
  async _getNetworkPromise({ timeoutId: e, request: t, logs: s, handler: a }) {
    let i, r;
    try {
      r = await a.fetchAndCachePut(t);
    } catch (o) {
      o instanceof Error && (i = o);
    }
    return e && clearTimeout(e), (i || !r) && (r = await a.cacheMatch(t)), r;
  }
}
class Ae extends N {
  /**
   * @param {Object} [options]
   * @param {Array<Object>} [options.plugins] [Plugins]{@link https://developers.google.com/web/tools/workbox/guides/using-plugins}
   * to use in conjunction with this caching strategy.
   * @param {Object} [options.fetchOptions] Values passed along to the
   * [`init`](https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/fetch#Parameters)
   * of [non-navigation](https://github.com/GoogleChrome/workbox/issues/1796)
   * `fetch()` requests made by this strategy.
   * @param {number} [options.networkTimeoutSeconds] If set, any network requests
   * that fail to respond within the timeout will result in a network error.
   */
  constructor(e = {}) {
    super(e), this._networkTimeoutSeconds = e.networkTimeoutSeconds || 0;
  }
  /**
   * @private
   * @param {Request|string} request A request to run this strategy for.
   * @param {workbox-strategies.StrategyHandler} handler The event that
   *     triggered the request.
   * @return {Promise<Response>}
   */
  async _handle(e, t) {
    let s, a;
    try {
      const i = [
        t.fetch(e)
      ];
      if (this._networkTimeoutSeconds) {
        const r = Y(this._networkTimeoutSeconds * 1e3);
        i.push(r);
      }
      if (a = await Promise.race(i), !a)
        throw new Error(`Timed out the network response after ${this._networkTimeoutSeconds} seconds.`);
    } catch (i) {
      i instanceof Error && (s = i);
    }
    if (!a)
      throw new l("no-response", { url: e.url, error: s });
    return a;
  }
}
class Me extends N {
  /**
   * @param {Object} [options]
   * @param {string} [options.cacheName] Cache name to store and retrieve
   * requests. Defaults to cache names provided by
   * {@link workbox-core.cacheNames}.
   * @param {Array<Object>} [options.plugins] [Plugins]{@link https://developers.google.com/web/tools/workbox/guides/using-plugins}
   * to use in conjunction with this caching strategy.
   * @param {Object} [options.fetchOptions] Values passed along to the
   * [`init`](https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/fetch#Parameters)
   * of [non-navigation](https://github.com/GoogleChrome/workbox/issues/1796)
   * `fetch()` requests made by this strategy.
   * @param {Object} [options.matchOptions] [`CacheQueryOptions`](https://w3c.github.io/ServiceWorker/#dictdef-cachequeryoptions)
   */
  constructor(e = {}) {
    super(e), this.plugins.some((t) => "cacheWillUpdate" in t) || this.plugins.unshift(te);
  }
  /**
   * @private
   * @param {Request|string} request A request to run this strategy for.
   * @param {workbox-strategies.StrategyHandler} handler The event that
   *     triggered the request.
   * @return {Promise<Response>}
   */
  async _handle(e, t) {
    const s = t.fetchAndCachePut(e).catch(() => {
    });
    t.waitUntil(s);
    let a = await t.cacheMatch(e), i;
    if (!a) try {
      a = await s;
    } catch (r) {
      r instanceof Error && (i = r);
    }
    if (!a)
      throw new l("no-response", { url: e.url, error: i });
    return a;
  }
}
function se(n) {
  n.then(() => {
  });
}
const Oe = (n, e) => e.some((t) => n instanceof t);
let Q, $;
function Ke() {
  return Q || (Q = [
    IDBDatabase,
    IDBObjectStore,
    IDBIndex,
    IDBCursor,
    IDBTransaction
  ]);
}
function Be() {
  return $ || ($ = [
    IDBCursor.prototype.advance,
    IDBCursor.prototype.continue,
    IDBCursor.prototype.continuePrimaryKey
  ]);
}
const ne = /* @__PURE__ */ new WeakMap(), O = /* @__PURE__ */ new WeakMap(), ae = /* @__PURE__ */ new WeakMap(), I = /* @__PURE__ */ new WeakMap(), W = /* @__PURE__ */ new WeakMap();
function We(n) {
  const e = new Promise((t, s) => {
    const a = () => {
      n.removeEventListener("success", i), n.removeEventListener("error", r);
    }, i = () => {
      t(m(n.result)), a();
    }, r = () => {
      s(n.error), a();
    };
    n.addEventListener("success", i), n.addEventListener("error", r);
  });
  return e.then((t) => {
    t instanceof IDBCursor && ne.set(t, n);
  }).catch(() => {
  }), W.set(e, n), e;
}
function je(n) {
  if (O.has(n))
    return;
  const e = new Promise((t, s) => {
    const a = () => {
      n.removeEventListener("complete", i), n.removeEventListener("error", r), n.removeEventListener("abort", r);
    }, i = () => {
      t(), a();
    }, r = () => {
      s(n.error || new DOMException("AbortError", "AbortError")), a();
    };
    n.addEventListener("complete", i), n.addEventListener("error", r), n.addEventListener("abort", r);
  });
  O.set(n, e);
}
let K = {
  get(n, e, t) {
    if (n instanceof IDBTransaction) {
      if (e === "done")
        return O.get(n);
      if (e === "objectStoreNames")
        return n.objectStoreNames || ae.get(n);
      if (e === "store")
        return t.objectStoreNames[1] ? void 0 : t.objectStore(t.objectStoreNames[0]);
    }
    return m(n[e]);
  },
  set(n, e, t) {
    return n[e] = t, !0;
  },
  has(n, e) {
    return n instanceof IDBTransaction && (e === "done" || e === "store") ? !0 : e in n;
  }
};
function Fe(n) {
  K = n(K);
}
function He(n) {
  return n === IDBDatabase.prototype.transaction && !("objectStoreNames" in IDBTransaction.prototype) ? function(e, ...t) {
    const s = n.call(q(this), e, ...t);
    return ae.set(s, e.sort ? e.sort() : [e]), m(s);
  } : Be().includes(n) ? function(...e) {
    return n.apply(q(this), e), m(ne.get(this));
  } : function(...e) {
    return m(n.apply(q(this), e));
  };
}
function Qe(n) {
  return typeof n == "function" ? He(n) : (n instanceof IDBTransaction && je(n), Oe(n, Ke()) ? new Proxy(n, K) : n);
}
function m(n) {
  if (n instanceof IDBRequest)
    return We(n);
  if (I.has(n))
    return I.get(n);
  const e = Qe(n);
  return e !== n && (I.set(n, e), W.set(e, n)), e;
}
const q = (n) => W.get(n);
function ie(n, e, { blocked: t, upgrade: s, blocking: a, terminated: i } = {}) {
  const r = indexedDB.open(n, e), o = m(r);
  return s && r.addEventListener("upgradeneeded", (c) => {
    s(m(r.result), c.oldVersion, c.newVersion, m(r.transaction), c);
  }), t && r.addEventListener("blocked", (c) => t(
    // Casting due to https://github.com/microsoft/TypeScript-DOM-lib-generator/pull/1405
    c.oldVersion,
    c.newVersion,
    c
  )), o.then((c) => {
    i && c.addEventListener("close", () => i()), a && c.addEventListener("versionchange", (h) => a(h.oldVersion, h.newVersion, h));
  }).catch(() => {
  }), o;
}
function $e(n, { blocked: e } = {}) {
  const t = indexedDB.deleteDatabase(n);
  return e && t.addEventListener("blocked", (s) => e(
    // Casting due to https://github.com/microsoft/TypeScript-DOM-lib-generator/pull/1405
    s.oldVersion,
    s
  )), m(t).then(() => {
  });
}
const Ve = ["get", "getKey", "getAll", "getAllKeys", "count"], ze = ["put", "add", "delete", "clear"], A = /* @__PURE__ */ new Map();
function V(n, e) {
  if (!(n instanceof IDBDatabase && !(e in n) && typeof e == "string"))
    return;
  if (A.get(e))
    return A.get(e);
  const t = e.replace(/FromIndex$/, ""), s = e !== t, a = ze.includes(t);
  if (
    // Bail if the target doesn't exist on the target. Eg, getAll isn't in Edge.
    !(t in (s ? IDBIndex : IDBObjectStore).prototype) || !(a || Ve.includes(t))
  )
    return;
  const i = async function(r, ...o) {
    const c = this.transaction(r, a ? "readwrite" : "readonly");
    let h = c.store;
    return s && (h = h.index(o.shift())), (await Promise.all([
      h[t](...o),
      a && c.done
    ]))[0];
  };
  return A.set(e, i), i;
}
Fe((n) => ({
  ...n,
  get: (e, t, s) => V(e, t) || n.get(e, t, s),
  has: (e, t) => !!V(e, t) || n.has(e, t)
}));
try {
  self["workbox:expiration:7.3.0"] && _();
} catch {
}
const Ge = "workbox-expiration", x = "cache-entries", z = (n) => {
  const e = new URL(n, location.href);
  return e.hash = "", e.href;
};
class Je {
  /**
   *
   * @param {string} cacheName
   *
   * @private
   */
  constructor(e) {
    this._db = null, this._cacheName = e;
  }
  /**
   * Performs an upgrade of indexedDB.
   *
   * @param {IDBPDatabase<CacheDbSchema>} db
   *
   * @private
   */
  _upgradeDb(e) {
    const t = e.createObjectStore(x, { keyPath: "id" });
    t.createIndex("cacheName", "cacheName", { unique: !1 }), t.createIndex("timestamp", "timestamp", { unique: !1 });
  }
  /**
   * Performs an upgrade of indexedDB and deletes deprecated DBs.
   *
   * @param {IDBPDatabase<CacheDbSchema>} db
   *
   * @private
   */
  _upgradeDbAndDeleteOldDbs(e) {
    this._upgradeDb(e), this._cacheName && $e(this._cacheName);
  }
  /**
   * @param {string} url
   * @param {number} timestamp
   *
   * @private
   */
  async setTimestamp(e, t) {
    e = z(e);
    const s = {
      url: e,
      timestamp: t,
      cacheName: this._cacheName,
      // Creating an ID from the URL and cache name won't be necessary once
      // Edge switches to Chromium and all browsers we support work with
      // array keyPaths.
      id: this._getId(e)
    }, i = (await this.getDb()).transaction(x, "readwrite", {
      durability: "relaxed"
    });
    await i.store.put(s), await i.done;
  }
  /**
   * Returns the timestamp stored for a given URL.
   *
   * @param {string} url
   * @return {number | undefined}
   *
   * @private
   */
  async getTimestamp(e) {
    const s = await (await this.getDb()).get(x, this._getId(e));
    return s == null ? void 0 : s.timestamp;
  }
  /**
   * Iterates through all the entries in the object store (from newest to
   * oldest) and removes entries once either `maxCount` is reached or the
   * entry's timestamp is less than `minTimestamp`.
   *
   * @param {number} minTimestamp
   * @param {number} maxCount
   * @return {Array<string>}
   *
   * @private
   */
  async expireEntries(e, t) {
    const s = await this.getDb();
    let a = await s.transaction(x).store.index("timestamp").openCursor(null, "prev");
    const i = [];
    let r = 0;
    for (; a; ) {
      const c = a.value;
      c.cacheName === this._cacheName && (e && c.timestamp < e || t && r >= t ? i.push(a.value) : r++), a = await a.continue();
    }
    const o = [];
    for (const c of i)
      await s.delete(x, c.id), o.push(c.url);
    return o;
  }
  /**
   * Takes a URL and returns an ID that will be unique in the object store.
   *
   * @param {string} url
   * @return {string}
   *
   * @private
   */
  _getId(e) {
    return this._cacheName + "|" + z(e);
  }
  /**
   * Returns an open connection to the database.
   *
   * @private
   */
  async getDb() {
    return this._db || (this._db = await ie(Ge, 1, {
      upgrade: this._upgradeDbAndDeleteOldDbs.bind(this)
    })), this._db;
  }
}
class Xe {
  /**
   * To construct a new CacheExpiration instance you must provide at least
   * one of the `config` properties.
   *
   * @param {string} cacheName Name of the cache to apply restrictions to.
   * @param {Object} config
   * @param {number} [config.maxEntries] The maximum number of entries to cache.
   * Entries used the least will be removed as the maximum is reached.
   * @param {number} [config.maxAgeSeconds] The maximum age of an entry before
   * it's treated as stale and removed.
   * @param {Object} [config.matchOptions] The [`CacheQueryOptions`](https://developer.mozilla.org/en-US/docs/Web/API/Cache/delete#Parameters)
   * that will be used when calling `delete()` on the cache.
   */
  constructor(e, t = {}) {
    this._isRunning = !1, this._rerunRequested = !1, this._maxEntries = t.maxEntries, this._maxAgeSeconds = t.maxAgeSeconds, this._matchOptions = t.matchOptions, this._cacheName = e, this._timestampModel = new Je(e);
  }
  /**
   * Expires entries for the given cache and given criteria.
   */
  async expireEntries() {
    if (this._isRunning) {
      this._rerunRequested = !0;
      return;
    }
    this._isRunning = !0;
    const e = this._maxAgeSeconds ? Date.now() - this._maxAgeSeconds * 1e3 : 0, t = await this._timestampModel.expireEntries(e, this._maxEntries), s = await self.caches.open(this._cacheName);
    for (const a of t)
      await s.delete(a, this._matchOptions);
    this._isRunning = !1, this._rerunRequested && (this._rerunRequested = !1, se(this.expireEntries()));
  }
  /**
   * Update the timestamp for the given URL. This ensures the when
   * removing entries based on maximum entries, most recently used
   * is accurate or when expiring, the timestamp is up-to-date.
   *
   * @param {string} url
   */
  async updateTimestamp(e) {
    await this._timestampModel.setTimestamp(e, Date.now());
  }
  /**
   * Can be used to check if a URL has expired or not before it's used.
   *
   * This requires a look up from IndexedDB, so can be slow.
   *
   * Note: This method will not remove the cached entry, call
   * `expireEntries()` to remove indexedDB and Cache entries.
   *
   * @param {string} url
   * @return {boolean}
   */
  async isURLExpired(e) {
    if (this._maxAgeSeconds) {
      const t = await this._timestampModel.getTimestamp(e), s = Date.now() - this._maxAgeSeconds * 1e3;
      return t !== void 0 ? t < s : !0;
    } else
      return !1;
  }
  /**
   * Removes the IndexedDB object store used to keep track of cache expiration
   * metadata.
   */
  async delete() {
    this._rerunRequested = !1, await this._timestampModel.expireEntries(1 / 0);
  }
}
function Ze(n) {
  Z.add(n);
}
class w {
  /**
   * @param {ExpirationPluginOptions} config
   * @param {number} [config.maxEntries] The maximum number of entries to cache.
   * Entries used the least will be removed as the maximum is reached.
   * @param {number} [config.maxAgeSeconds] The maximum age of an entry before
   * it's treated as stale and removed.
   * @param {Object} [config.matchOptions] The [`CacheQueryOptions`](https://developer.mozilla.org/en-US/docs/Web/API/Cache/delete#Parameters)
   * that will be used when calling `delete()` on the cache.
   * @param {boolean} [config.purgeOnQuotaError] Whether to opt this cache in to
   * automatic deletion if the available storage quota has been exceeded.
   */
  constructor(e = {}) {
    this.cachedResponseWillBeUsed = async ({ event: t, request: s, cacheName: a, cachedResponse: i }) => {
      if (!i)
        return null;
      const r = this._isResponseDateFresh(i), o = this._getCacheExpiration(a);
      se(o.expireEntries());
      const c = o.updateTimestamp(s.url);
      if (t)
        try {
          t.waitUntil(c);
        } catch {
        }
      return r ? i : null;
    }, this.cacheDidUpdate = async ({ cacheName: t, request: s }) => {
      const a = this._getCacheExpiration(t);
      await a.updateTimestamp(s.url), await a.expireEntries();
    }, this._config = e, this._maxAgeSeconds = e.maxAgeSeconds, this._cacheExpirations = /* @__PURE__ */ new Map(), e.purgeOnQuotaError && Ze(() => this.deleteCacheAndMetadata());
  }
  /**
   * A simple helper method to return a CacheExpiration instance for a given
   * cache name.
   *
   * @param {string} cacheName
   * @return {CacheExpiration}
   *
   * @private
   */
  _getCacheExpiration(e) {
    if (e === T.getRuntimeName())
      throw new l("expire-custom-caches-only");
    let t = this._cacheExpirations.get(e);
    return t || (t = new Xe(e, this._config), this._cacheExpirations.set(e, t)), t;
  }
  /**
   * @param {Response} cachedResponse
   * @return {boolean}
   *
   * @private
   */
  _isResponseDateFresh(e) {
    if (!this._maxAgeSeconds)
      return !0;
    const t = this._getDateHeaderTimestamp(e);
    if (t === null)
      return !0;
    const s = Date.now();
    return t >= s - this._maxAgeSeconds * 1e3;
  }
  /**
   * This method will extract the data header and parse it into a useful
   * value.
   *
   * @param {Response} cachedResponse
   * @return {number|null}
   *
   * @private
   */
  _getDateHeaderTimestamp(e) {
    if (!e.headers.has("date"))
      return null;
    const t = e.headers.get("date"), a = new Date(t).getTime();
    return isNaN(a) ? null : a;
  }
  /**
   * This is a helper method that performs two operations:
   *
   * - Deletes *all* the underlying Cache instances associated with this plugin
   * instance, by calling caches.delete() on your behalf.
   * - Deletes the metadata from IndexedDB used to keep track of expiration
   * details for each Cache instance.
   *
   * When using cache expiration, calling this method is preferable to calling
   * `caches.delete()` directly, since this will ensure that the IndexedDB
   * metadata is also cleanly removed and open IndexedDB instances are deleted.
   *
   * Note that if you're *not* using cache expiration for a given cache, calling
   * `caches.delete()` and passing in the cache's name should be sufficient.
   * There is no Workbox-specific method needed for cleanup in that case.
   */
  async deleteCacheAndMetadata() {
    for (const [e, t] of this._cacheExpirations)
      await self.caches.delete(e), await t.delete();
    this._cacheExpirations = /* @__PURE__ */ new Map();
  }
}
try {
  self["workbox:cacheable-response:7.3.0"] && _();
} catch {
}
class Ye {
  /**
   * To construct a new CacheableResponse instance you must provide at least
   * one of the `config` properties.
   *
   * If both `statuses` and `headers` are specified, then both conditions must
   * be met for the `Response` to be considered cacheable.
   *
   * @param {Object} config
   * @param {Array<number>} [config.statuses] One or more status codes that a
   * `Response` can have and be considered cacheable.
   * @param {Object<string,string>} [config.headers] A mapping of header names
   * and expected values that a `Response` can have and be considered cacheable.
   * If multiple headers are provided, only one needs to be present.
   */
  constructor(e = {}) {
    this._statuses = e.statuses, this._headers = e.headers;
  }
  /**
   * Checks a response to see whether it's cacheable or not, based on this
   * object's configuration.
   *
   * @param {Response} response The response whose cacheability is being
   * checked.
   * @return {boolean} `true` if the `Response` is cacheable, and `false`
   * otherwise.
   */
  isResponseCacheable(e) {
    let t = !0;
    return this._statuses && (t = this._statuses.includes(e.status)), this._headers && t && (t = Object.keys(this._headers).some((s) => e.headers.get(s) === this._headers[s])), t;
  }
}
class b {
  /**
   * To construct a new CacheableResponsePlugin instance you must provide at
   * least one of the `config` properties.
   *
   * If both `statuses` and `headers` are specified, then both conditions must
   * be met for the `Response` to be considered cacheable.
   *
   * @param {Object} config
   * @param {Array<number>} [config.statuses] One or more status codes that a
   * `Response` can have and be considered cacheable.
   * @param {Object<string,string>} [config.headers] A mapping of header names
   * and expected values that a `Response` can have and be considered cacheable.
   * If multiple headers are provided, only one needs to be present.
   */
  constructor(e) {
    this.cacheWillUpdate = async ({ response: t }) => this._cacheableResponse.isResponseCacheable(t) ? t : null, this._cacheableResponse = new Ye(e);
  }
}
try {
  self["workbox:background-sync:7.3.0"] && _();
} catch {
}
const G = 3, et = "workbox-background-sync", f = "requests", D = "queueName";
class tt {
  constructor() {
    this._db = null;
  }
  /**
   * Add QueueStoreEntry to underlying db.
   *
   * @param {UnidentifiedQueueStoreEntry} entry
   */
  async addEntry(e) {
    const s = (await this.getDb()).transaction(f, "readwrite", {
      durability: "relaxed"
    });
    await s.store.add(e), await s.done;
  }
  /**
   * Returns the first entry id in the ObjectStore.
   *
   * @return {number | undefined}
   */
  async getFirstEntryId() {
    const t = await (await this.getDb()).transaction(f).store.openCursor();
    return t == null ? void 0 : t.value.id;
  }
  /**
   * Get all the entries filtered by index
   *
   * @param queueName
   * @return {Promise<QueueStoreEntry[]>}
   */
  async getAllEntriesByQueueName(e) {
    const s = await (await this.getDb()).getAllFromIndex(f, D, IDBKeyRange.only(e));
    return s || new Array();
  }
  /**
   * Returns the number of entries filtered by index
   *
   * @param queueName
   * @return {Promise<number>}
   */
  async getEntryCountByQueueName(e) {
    return (await this.getDb()).countFromIndex(f, D, IDBKeyRange.only(e));
  }
  /**
   * Deletes a single entry by id.
   *
   * @param {number} id the id of the entry to be deleted
   */
  async deleteEntry(e) {
    await (await this.getDb()).delete(f, e);
  }
  /**
   *
   * @param queueName
   * @returns {Promise<QueueStoreEntry | undefined>}
   */
  async getFirstEntryByQueueName(e) {
    return await this.getEndEntryFromIndex(IDBKeyRange.only(e), "next");
  }
  /**
   *
   * @param queueName
   * @returns {Promise<QueueStoreEntry | undefined>}
   */
  async getLastEntryByQueueName(e) {
    return await this.getEndEntryFromIndex(IDBKeyRange.only(e), "prev");
  }
  /**
   * Returns either the first or the last entries, depending on direction.
   * Filtered by index.
   *
   * @param {IDBCursorDirection} direction
   * @param {IDBKeyRange} query
   * @return {Promise<QueueStoreEntry | undefined>}
   * @private
   */
  async getEndEntryFromIndex(e, t) {
    const a = await (await this.getDb()).transaction(f).store.index(D).openCursor(e, t);
    return a == null ? void 0 : a.value;
  }
  /**
   * Returns an open connection to the database.
   *
   * @private
   */
  async getDb() {
    return this._db || (this._db = await ie(et, G, {
      upgrade: this._upgradeDb
    })), this._db;
  }
  /**
   * Upgrades QueueDB
   *
   * @param {IDBPDatabase<QueueDBSchema>} db
   * @param {number} oldVersion
   * @private
   */
  _upgradeDb(e, t) {
    t > 0 && t < G && e.objectStoreNames.contains(f) && e.deleteObjectStore(f), e.createObjectStore(f, {
      autoIncrement: !0,
      keyPath: "id"
    }).createIndex(D, D, { unique: !1 });
  }
}
class st {
  /**
   * Associates this instance with a Queue instance, so entries added can be
   * identified by their queue name.
   *
   * @param {string} queueName
   */
  constructor(e) {
    this._queueName = e, this._queueDb = new tt();
  }
  /**
   * Append an entry last in the queue.
   *
   * @param {Object} entry
   * @param {Object} entry.requestData
   * @param {number} [entry.timestamp]
   * @param {Object} [entry.metadata]
   */
  async pushEntry(e) {
    delete e.id, e.queueName = this._queueName, await this._queueDb.addEntry(e);
  }
  /**
   * Prepend an entry first in the queue.
   *
   * @param {Object} entry
   * @param {Object} entry.requestData
   * @param {number} [entry.timestamp]
   * @param {Object} [entry.metadata]
   */
  async unshiftEntry(e) {
    const t = await this._queueDb.getFirstEntryId();
    t ? e.id = t - 1 : delete e.id, e.queueName = this._queueName, await this._queueDb.addEntry(e);
  }
  /**
   * Removes and returns the last entry in the queue matching the `queueName`.
   *
   * @return {Promise<QueueStoreEntry|undefined>}
   */
  async popEntry() {
    return this._removeEntry(await this._queueDb.getLastEntryByQueueName(this._queueName));
  }
  /**
   * Removes and returns the first entry in the queue matching the `queueName`.
   *
   * @return {Promise<QueueStoreEntry|undefined>}
   */
  async shiftEntry() {
    return this._removeEntry(await this._queueDb.getFirstEntryByQueueName(this._queueName));
  }
  /**
   * Returns all entries in the store matching the `queueName`.
   *
   * @param {Object} options See {@link workbox-background-sync.Queue~getAll}
   * @return {Promise<Array<Object>>}
   */
  async getAll() {
    return await this._queueDb.getAllEntriesByQueueName(this._queueName);
  }
  /**
   * Returns the number of entries in the store matching the `queueName`.
   *
   * @param {Object} options See {@link workbox-background-sync.Queue~size}
   * @return {Promise<number>}
   */
  async size() {
    return await this._queueDb.getEntryCountByQueueName(this._queueName);
  }
  /**
   * Deletes the entry for the given ID.
   *
   * WARNING: this method does not ensure the deleted entry belongs to this
   * queue (i.e. matches the `queueName`). But this limitation is acceptable
   * as this class is not publicly exposed. An additional check would make
   * this method slower than it needs to be.
   *
   * @param {number} id
   */
  async deleteEntry(e) {
    await this._queueDb.deleteEntry(e);
  }
  /**
   * Removes and returns the first or last entry in the queue (based on the
   * `direction` argument) matching the `queueName`.
   *
   * @return {Promise<QueueStoreEntry|undefined>}
   * @private
   */
  async _removeEntry(e) {
    return e && await this.deleteEntry(e.id), e;
  }
}
const nt = [
  "method",
  "referrer",
  "referrerPolicy",
  "mode",
  "credentials",
  "cache",
  "redirect",
  "integrity",
  "keepalive"
];
class k {
  /**
   * Converts a Request object to a plain object that can be structured
   * cloned or JSON-stringified.
   *
   * @param {Request} request
   * @return {Promise<StorableRequest>}
   */
  static async fromRequest(e) {
    const t = {
      url: e.url,
      headers: {}
    };
    e.method !== "GET" && (t.body = await e.clone().arrayBuffer());
    for (const [s, a] of e.headers.entries())
      t.headers[s] = a;
    for (const s of nt)
      e[s] !== void 0 && (t[s] = e[s]);
    return new k(t);
  }
  /**
   * Accepts an object of request data that can be used to construct a
   * `Request` but can also be stored in IndexedDB.
   *
   * @param {Object} requestData An object of request data that includes the
   *     `url` plus any relevant properties of
   *     [requestInit]{@link https://fetch.spec.whatwg.org/#requestinit}.
   */
  constructor(e) {
    e.mode === "navigate" && (e.mode = "same-origin"), this._requestData = e;
  }
  /**
   * Returns a deep clone of the instances `_requestData` object.
   *
   * @return {Object}
   */
  toObject() {
    const e = Object.assign({}, this._requestData);
    return e.headers = Object.assign({}, this._requestData.headers), e.body && (e.body = e.body.slice(0)), e;
  }
  /**
   * Converts this instance to a Request.
   *
   * @return {Request}
   */
  toRequest() {
    return new Request(this._requestData.url, this._requestData);
  }
  /**
   * Creates and returns a deep clone of the instance.
   *
   * @return {StorableRequest}
   */
  clone() {
    return new k(this.toObject());
  }
}
const J = "workbox-background-sync", at = 60 * 24 * 7, M = /* @__PURE__ */ new Set(), X = (n) => {
  const e = {
    request: new k(n.requestData).toRequest(),
    timestamp: n.timestamp
  };
  return n.metadata && (e.metadata = n.metadata), e;
};
class it {
  /**
   * Creates an instance of Queue with the given options
   *
   * @param {string} name The unique name for this queue. This name must be
   *     unique as it's used to register sync events and store requests
   *     in IndexedDB specific to this instance. An error will be thrown if
   *     a duplicate name is detected.
   * @param {Object} [options]
   * @param {Function} [options.onSync] A function that gets invoked whenever
   *     the 'sync' event fires. The function is invoked with an object
   *     containing the `queue` property (referencing this instance), and you
   *     can use the callback to customize the replay behavior of the queue.
   *     When not set the `replayRequests()` method is called.
   *     Note: if the replay fails after a sync event, make sure you throw an
   *     error, so the browser knows to retry the sync event later.
   * @param {number} [options.maxRetentionTime=7 days] The amount of time (in
   *     minutes) a request may be retried. After this amount of time has
   *     passed, the request will be deleted from the queue.
   * @param {boolean} [options.forceSyncFallback=false] If `true`, instead
   *     of attempting to use background sync events, always attempt to replay
   *     queued request at service worker startup. Most folks will not need
   *     this, unless you explicitly target a runtime like Electron that
   *     exposes the interfaces for background sync, but does not have a working
   *     implementation.
   */
  constructor(e, { forceSyncFallback: t, onSync: s, maxRetentionTime: a } = {}) {
    if (this._syncInProgress = !1, this._requestsAddedDuringSync = !1, M.has(e))
      throw new l("duplicate-queue-name", { name: e });
    M.add(e), this._name = e, this._onSync = s || this.replayRequests, this._maxRetentionTime = a || at, this._forceSyncFallback = !!t, this._queueStore = new st(this._name), this._addSyncListener();
  }
  /**
   * @return {string}
   */
  get name() {
    return this._name;
  }
  /**
   * Stores the passed request in IndexedDB (with its timestamp and any
   * metadata) at the end of the queue.
   *
   * @param {QueueEntry} entry
   * @param {Request} entry.request The request to store in the queue.
   * @param {Object} [entry.metadata] Any metadata you want associated with the
   *     stored request. When requests are replayed you'll have access to this
   *     metadata object in case you need to modify the request beforehand.
   * @param {number} [entry.timestamp] The timestamp (Epoch time in
   *     milliseconds) when the request was first added to the queue. This is
   *     used along with `maxRetentionTime` to remove outdated requests. In
   *     general you don't need to set this value, as it's automatically set
   *     for you (defaulting to `Date.now()`), but you can update it if you
   *     don't want particular requests to expire.
   */
  async pushRequest(e) {
    await this._addRequest(e, "push");
  }
  /**
   * Stores the passed request in IndexedDB (with its timestamp and any
   * metadata) at the beginning of the queue.
   *
   * @param {QueueEntry} entry
   * @param {Request} entry.request The request to store in the queue.
   * @param {Object} [entry.metadata] Any metadata you want associated with the
   *     stored request. When requests are replayed you'll have access to this
   *     metadata object in case you need to modify the request beforehand.
   * @param {number} [entry.timestamp] The timestamp (Epoch time in
   *     milliseconds) when the request was first added to the queue. This is
   *     used along with `maxRetentionTime` to remove outdated requests. In
   *     general you don't need to set this value, as it's automatically set
   *     for you (defaulting to `Date.now()`), but you can update it if you
   *     don't want particular requests to expire.
   */
  async unshiftRequest(e) {
    await this._addRequest(e, "unshift");
  }
  /**
   * Removes and returns the last request in the queue (along with its
   * timestamp and any metadata). The returned object takes the form:
   * `{request, timestamp, metadata}`.
   *
   * @return {Promise<QueueEntry | undefined>}
   */
  async popRequest() {
    return this._removeRequest("pop");
  }
  /**
   * Removes and returns the first request in the queue (along with its
   * timestamp and any metadata). The returned object takes the form:
   * `{request, timestamp, metadata}`.
   *
   * @return {Promise<QueueEntry | undefined>}
   */
  async shiftRequest() {
    return this._removeRequest("shift");
  }
  /**
   * Returns all the entries that have not expired (per `maxRetentionTime`).
   * Any expired entries are removed from the queue.
   *
   * @return {Promise<Array<QueueEntry>>}
   */
  async getAll() {
    const e = await this._queueStore.getAll(), t = Date.now(), s = [];
    for (const a of e) {
      const i = this._maxRetentionTime * 60 * 1e3;
      t - a.timestamp > i ? await this._queueStore.deleteEntry(a.id) : s.push(X(a));
    }
    return s;
  }
  /**
   * Returns the number of entries present in the queue.
   * Note that expired entries (per `maxRetentionTime`) are also included in this count.
   *
   * @return {Promise<number>}
   */
  async size() {
    return await this._queueStore.size();
  }
  /**
   * Adds the entry to the QueueStore and registers for a sync event.
   *
   * @param {Object} entry
   * @param {Request} entry.request
   * @param {Object} [entry.metadata]
   * @param {number} [entry.timestamp=Date.now()]
   * @param {string} operation ('push' or 'unshift')
   * @private
   */
  async _addRequest({ request: e, metadata: t, timestamp: s = Date.now() }, a) {
    const r = {
      requestData: (await k.fromRequest(e.clone())).toObject(),
      timestamp: s
    };
    switch (t && (r.metadata = t), a) {
      case "push":
        await this._queueStore.pushEntry(r);
        break;
      case "unshift":
        await this._queueStore.unshiftEntry(r);
        break;
    }
    this._syncInProgress ? this._requestsAddedDuringSync = !0 : await this.registerSync();
  }
  /**
   * Removes and returns the first or last (depending on `operation`) entry
   * from the QueueStore that's not older than the `maxRetentionTime`.
   *
   * @param {string} operation ('pop' or 'shift')
   * @return {Object|undefined}
   * @private
   */
  async _removeRequest(e) {
    const t = Date.now();
    let s;
    switch (e) {
      case "pop":
        s = await this._queueStore.popEntry();
        break;
      case "shift":
        s = await this._queueStore.shiftEntry();
        break;
    }
    if (s) {
      const a = this._maxRetentionTime * 60 * 1e3;
      return t - s.timestamp > a ? this._removeRequest(e) : X(s);
    } else
      return;
  }
  /**
   * Loops through each request in the queue and attempts to re-fetch it.
   * If any request fails to re-fetch, it's put back in the same position in
   * the queue (which registers a retry for the next sync event).
   */
  async replayRequests() {
    let e;
    for (; e = await this.shiftRequest(); )
      try {
        await fetch(e.request.clone());
      } catch {
        throw await this.unshiftRequest(e), new l("queue-replay-failed", { name: this._name });
      }
  }
  /**
   * Registers a sync event with a tag unique to this instance.
   */
  async registerSync() {
    if ("sync" in self.registration && !this._forceSyncFallback)
      try {
        await self.registration.sync.register(`${J}:${this._name}`);
      } catch {
      }
  }
  /**
   * In sync-supporting browsers, this adds a listener for the sync event.
   * In non-sync-supporting browsers, or if _forceSyncFallback is true, this
   * will retry the queue on service worker startup.
   *
   * @private
   */
  _addSyncListener() {
    "sync" in self.registration && !this._forceSyncFallback ? self.addEventListener("sync", (e) => {
      if (e.tag === `${J}:${this._name}`) {
        const t = async () => {
          this._syncInProgress = !0;
          let s;
          try {
            await this._onSync({ queue: this });
          } catch (a) {
            if (a instanceof Error)
              throw s = a, s;
          } finally {
            this._requestsAddedDuringSync && !(s && !e.lastChance) && await this.registerSync(), this._syncInProgress = !1, this._requestsAddedDuringSync = !1;
          }
        };
        e.waitUntil(t());
      }
    }) : this._onSync({ queue: this });
  }
  /**
   * Returns the set of queue names. This is primarily used to reset the list
   * of queue names in tests.
   *
   * @return {Set<string>}
   *
   * @private
   */
  static get _queueNames() {
    return M;
  }
}
class rt {
  /**
   * @param {string} name See the {@link workbox-background-sync.Queue}
   *     documentation for parameter details.
   * @param {Object} [options] See the
   *     {@link workbox-background-sync.Queue} documentation for
   *     parameter details.
   */
  constructor(e, t) {
    this.fetchDidFail = async ({ request: s }) => {
      await this._queue.pushRequest({ request: s });
    }, this._queue = new it(e, t);
  }
}
function ot() {
  self.addEventListener("activate", () => self.clients.claim());
}
self.skipWaiting();
ot();
ve([{"revision":"a64dd5f025505737abbd7e0ee5570fd6","url":"transactions.html"},{"revision":"2ef997849406395530f999f7e5834a19","url":"trabaja-con-nosotros.html"},{"revision":"4f8f98640c16b57c280807d1d79f17f9","url":"terms.html"},{"revision":"5e2dc258ffb1c3c844977b0d4081c3e9","url":"solicitud-solidaria.html"},{"revision":"0b1f6e5a9b4bce9f3968052e5366855d","url":"roadmap.html"},{"revision":"a3b74b8f7b347052e24856914a8bbfb8","url":"registerSW.js"},{"revision":"f15f6c814285315508cefbdefed53c60","url":"register.html"},{"revision":"55f651735746ad165db3fd83a3f0990d","url":"referrals.html"},{"revision":"820b0ec14990b04efdfe03c1bcdd32a0","url":"publish.html"},{"revision":"33c4af6a1b46f720c176297a7b45e739","url":"publication-detail.html"},{"revision":"75ad0e5a558de0236ee8c66e2916ad4b","url":"profile.html"},{"revision":"aca79227d80fee4195e3bd0ea6bd6da0","url":"privacy.html"},{"revision":"7c805c47b68fb29d5937bce94bb4c61f","url":"pedir-ayuda.html"},{"revision":"7fec5d3c79a24981a460570f254df53e","url":"p2p.html"},{"revision":"596e21ae144800ff5af2512abee083f4","url":"p2p-history.html"},{"revision":"552e1908fda0e872d6b00ac37525e917","url":"ofrecer-ayuda.html"},{"revision":"5f58e940539449005e4023f004dfd0c4","url":"momentum-landing.html"},{"revision":"3281063a7ba3c8b258b1107b29d216df","url":"momentum-dashboard.html"},{"revision":"106a1d7a5a68f1f5f0a19dfa76700cd6","url":"momentum-admin.html"},{"revision":"432b706f04cc1215024acfaa282e122f","url":"migrate.html"},{"revision":"74e53332c421997c5381afba2c01142f","url":"love.html"},{"revision":"4d50e380d621b06b20e388bf6e1cbfd8","url":"login.html"},{"revision":"e38f76940c923f9cec98d4e4ca0cc403","url":"legado.html"},{"revision":"2dac8533a72896258a30da9031f1c07d","url":"index.html"},{"revision":"630b5682027c2dabb4492e6a5497588b","url":"history.html"},{"revision":"2bdbc5de6c86ebe3a09cd721c0d8200b","url":"governance-panel.html"},{"revision":"66915b3ad7f1dcf63d867c95fe68ad1c","url":"forgot-password.html"},{"revision":"f4df0031953633bf761bd65f822b3fb5","url":"faq.html"},{"revision":"0202f6f25d431f7e613eeb258a196839","url":"estado-cuenta.html"},{"revision":"4607663babcb44b616e8cd79d0439201","url":"documentation.html"},{"revision":"af115523366f3602991dac1ddd6fb9d1","url":"docs.html"},{"revision":"219ffcba89a157896b967b43c02bea53","url":"contract_interaction.html"},{"revision":"32684f3420501af10acc1d3feb7367d7","url":"como-funciona.html"},{"revision":"1876497671a2ff7464e5f369b9283fa5","url":"causa-solidaria.html"},{"revision":"364df98f4cd6b869a4c0e2df2e61bc20","url":"booster-profile.html"},{"revision":"c9fd1307ede2a3b27b150d03fa823416","url":"admin.html"},{"revision":"0b21952c88f60128ad1e0008baec99fa","url":"admin-recruitment.html"},{"revision":"743fabfab2b721501f1072aec8362936","url":"admin-panel.html"},{"revision":null,"url":"assets/wintoncoin_community_help.2J04UrSK.png"},{"revision":null,"url":"assets/vendor.l0sNRNKZ.js"},{"revision":null,"url":"assets/transactions.CenTnPbY.js"},{"revision":null,"url":"assets/style.C7Ud9owh.css"},{"revision":null,"url":"assets/stickman_viral_fomo.wkublVzu.png"},{"revision":null,"url":"assets/solicitudSolidaria.BrefmVnM.js"},{"revision":null,"url":"assets/register.CDc5c81f.js"},{"revision":null,"url":"assets/referrals.Cz6IGSpo.js"},{"revision":null,"url":"assets/red_token_logo.CM7s5VwX.png"},{"revision":null,"url":"assets/pushManager.C2effs3l.js"},{"revision":null,"url":"assets/pushManager.B1WnFsPR.css"},{"revision":null,"url":"assets/publish.CFyf9t76.js"},{"revision":null,"url":"assets/publicationDetail.BWd65ADs.js"},{"revision":null,"url":"assets/profile.BpF-BvdV.js"},{"revision":null,"url":"assets/pedirAyuda.qJ5oB8DN.css"},{"revision":null,"url":"assets/p2pHistory.BBzTp2Qm.js"},{"revision":null,"url":"assets/p2p.DMGFxg83.js"},{"revision":null,"url":"assets/momentumLanding.Q026mnDU.css"},{"revision":null,"url":"assets/momentumLanding.BvYcbQT_.js"},{"revision":null,"url":"assets/momentumDashboard.D7aUGb0A.js"},{"revision":null,"url":"assets/momentumAdmin.7_m-i2Os.js"},{"revision":null,"url":"assets/momentum-dashboard.PVUfBBWy.css"},{"revision":null,"url":"assets/modulepreload-polyfill.B5Qt9EMX.js"},{"revision":null,"url":"assets/main.D-E8-YLy.css"},{"revision":null,"url":"assets/main.CXy4VWSJ.js"},{"revision":null,"url":"assets/love.CVH1u3w5.js"},{"revision":null,"url":"assets/logo-high-res.DqBzE5O1.png"},{"revision":null,"url":"assets/login.B9UMG5XD.js"},{"revision":null,"url":"assets/landing.Bhf4toDS.css"},{"revision":null,"url":"assets/index.Dk_Cx65J.js"},{"revision":null,"url":"assets/icon-96x96.DCzaNkg0.png"},{"revision":null,"url":"assets/icon-72x72.BGJbw9VK.png"},{"revision":null,"url":"assets/icon-192x192.DTV1SGDv.png"},{"revision":null,"url":"assets/icon-152x152.HiZk-PlL.png"},{"revision":null,"url":"assets/history.D4fjrcIG.js"},{"revision":null,"url":"assets/governancePanel.DY2FMcVR.js"},{"revision":null,"url":"assets/forgotPassword.DRmrIHec.js"},{"revision":null,"url":"assets/favicon.DuxeKF20.ico"},{"revision":null,"url":"assets/favicon-16x16.qlexLwP3.png"},{"revision":null,"url":"assets/estadoCuenta.Di53ByOM.js"},{"revision":null,"url":"assets/dashboard.afCmDRgp.js"},{"revision":null,"url":"assets/config.Br4uoD7s.js"},{"revision":null,"url":"assets/comoFunciona.CfJ2Twvp.js"},{"revision":null,"url":"assets/community_network.DDw0Rewc.png"},{"revision":null,"url":"assets/causaSolidaria.BPfjM1F8.js"},{"revision":null,"url":"assets/capability_capital.Ce2dbGNu.png"},{"revision":null,"url":"assets/boosterProfile.D1nq2NgT.js"},{"revision":null,"url":"assets/booster-style.D-r1XA9w.css"},{"revision":null,"url":"assets/auth.PfzP10z-.js"},{"revision":null,"url":"assets/apple-touch-icon.BskCKsiM.png"},{"revision":null,"url":"assets/alerts.CawRDXDp.js"},{"revision":null,"url":"assets/adminPanel.kmd3WUl7.js"},{"revision":null,"url":"assets/admin.Bv19838c.js"},{"revision":null,"url":"assets/admin-switch.z10rU-x2.css"},{"revision":null,"url":"assets/admin-style.DYNolwp4.css"},{"revision":null,"url":"assets/images/money-pattern.png"},{"revision":null,"url":"assets/images/tutorial/step3_toggle.png"},{"revision":null,"url":"assets/images/tutorial/step3_pwa_toggle.png"},{"revision":null,"url":"assets/images/tutorial/step3_pwa_.png"},{"revision":null,"url":"assets/images/tutorial/step2_pwa_info.png"},{"revision":null,"url":"assets/images/tutorial/step2_permissions.png"},{"revision":null,"url":"assets/images/tutorial/step1_pwa_icon.png"},{"revision":null,"url":"assets/images/tutorial/step1_lock.png"},{"revision":null,"url":"assets/images/tutorial/step1_lock(2).png"},{"revision":null,"url":"assets/images/tutorial/intro_pwa.png"},{"revision":null,"url":"assets/images/landing/wintoncoin_community_help.png"},{"revision":null,"url":"assets/images/landing/viral_influencers_3d_1771110073020.jpg"},{"revision":null,"url":"assets/images/landing/token_duality.png"},{"revision":null,"url":"assets/images/landing/stickman_viral_fomo.png"},{"revision":null,"url":"assets/images/landing/social_viral_explosion_1771110629335.jpg"},{"revision":null,"url":"assets/images/landing/social_media_fomo_1771110554954.jpg"},{"revision":null,"url":"assets/images/landing/social_fomo_explosion_1771110313830.jpg"},{"revision":null,"url":"assets/images/landing/red_token_logo.png"},{"revision":null,"url":"assets/images/landing/network_3d.png"},{"revision":null,"url":"assets/images/landing/hero_bg.png"},{"revision":null,"url":"assets/images/landing/community_network_1771098393599.jpg"},{"revision":null,"url":"assets/images/landing/community_network.png"},{"revision":null,"url":"assets/images/landing/capability_capital.png"},{"revision":null,"url":"assets/images/landing/blue_red_tokens_3d.png"},{"revision":null,"url":"assets/images/landing/blue_red_duality.png"},{"revision":null,"url":"assets/icons/old-logo.png"},{"revision":null,"url":"assets/icons/logo-high-res.png"},{"revision":null,"url":"assets/icons/icon-maskable-512x512.png"},{"revision":null,"url":"assets/icons/icon-maskable-192x192.png"},{"revision":null,"url":"assets/icons/icon-96x96.png"},{"revision":null,"url":"assets/icons/icon-72x72.png"},{"revision":null,"url":"assets/icons/icon-64x64.png"},{"revision":null,"url":"assets/icons/icon-512x512.png"},{"revision":null,"url":"assets/icons/icon-48x48.png"},{"revision":null,"url":"assets/icons/icon-384x384.png"},{"revision":null,"url":"assets/icons/icon-192x192.png"},{"revision":null,"url":"assets/icons/icon-152x152.png"},{"revision":null,"url":"assets/icons/icon-144x144.png"},{"revision":null,"url":"assets/icons/icon-128x128.png"},{"revision":null,"url":"assets/icons/favicon.ico"},{"revision":null,"url":"assets/icons/favicon-32x32.png"},{"revision":null,"url":"assets/icons/favicon-16x16.png"},{"revision":null,"url":"assets/icons/demo-icon-maskable-512x512.png"},{"revision":null,"url":"assets/icons/demo-icon-maskable-192x192.png"},{"revision":null,"url":"assets/icons/demo-icon-96x96.png"},{"revision":null,"url":"assets/icons/demo-icon-72x72.png"},{"revision":null,"url":"assets/icons/demo-icon-64x64.png"},{"revision":null,"url":"assets/icons/demo-icon-512x512.png"},{"revision":null,"url":"assets/icons/demo-icon-48x48.png"},{"revision":null,"url":"assets/icons/demo-icon-384x384.png"},{"revision":null,"url":"assets/icons/demo-icon-192x192.png"},{"revision":null,"url":"assets/icons/demo-icon-152x152.png"},{"revision":null,"url":"assets/icons/demo-icon-144x144.png"},{"revision":null,"url":"assets/icons/demo-icon-128x128.png"},{"revision":null,"url":"assets/icons/apple-touch-icon.png"},{"revision":null,"url":"assets/branding/wintoncoin_transparent_phrase.png"},{"revision":null,"url":"assets/branding/wintoncoin_phrase_blue.png"},{"revision":null,"url":"assets/branding/logo-high-res.png"},{"revision":null,"url":"assets/branding/icon-96x96.png"},{"revision":null,"url":"assets/branding/icon-72x72.png"},{"revision":null,"url":"assets/branding/icon-512x512.png"},{"revision":null,"url":"assets/branding/icon-48x48.png"},{"revision":null,"url":"assets/branding/icon-192x192.png"},{"revision":null,"url":"assets/branding/icon-128x128.png"},{"revision":"ba8d44c6226789f0fb12c8151f2f9663","url":"manifest.json"},{"revision":"cfc17828928ccad6fe2ea80257a23ca4","url":"assets/icons/apple-touch-icon.png"},{"revision":"ee6dc3a45f43b167fe9b3d7dcd2c01d8","url":"assets/icons/demo-icon-128x128.png"},{"revision":"7efea3827c1b1b3de08e887fd6043dc8","url":"assets/icons/demo-icon-144x144.png"},{"revision":"16ca5d3d3bbc20ffd67141c352595374","url":"assets/icons/demo-icon-152x152.png"},{"revision":"5a6a3a215ceedafb5f068d8156818367","url":"assets/icons/demo-icon-192x192.png"},{"revision":"fd8d8b2e2bbb303bd1866bf4caaf900e","url":"assets/icons/demo-icon-384x384.png"},{"revision":"af5167119f3aff3e0917aaff853319eb","url":"assets/icons/demo-icon-48x48.png"},{"revision":"6d55be406597f49d9dbb3d7744812eb7","url":"assets/icons/demo-icon-512x512.png"},{"revision":"cf1694ee7e9672bf61ef816a9b209e68","url":"assets/icons/demo-icon-64x64.png"},{"revision":"9b1be3e55df23fedb8e74965654c43ff","url":"assets/icons/demo-icon-72x72.png"},{"revision":"270e6531feafa8534fc5ef3753b5473c","url":"assets/icons/demo-icon-96x96.png"},{"revision":"ecd45af3434bf635f097795793496859","url":"assets/icons/demo-icon-maskable-192x192.png"},{"revision":"e252617913a2d0aef8d0d40c8549043f","url":"assets/icons/demo-icon-maskable-512x512.png"},{"revision":"1b77c07d3334b1141be6057276678b10","url":"assets/icons/favicon-16x16.png"},{"revision":"fccac10b8643a34348cdbc10b551b5a4","url":"assets/icons/favicon-32x32.png"},{"revision":"0120d8e2a048e138eea70c8377dcbf38","url":"assets/icons/icon-128x128.png"},{"revision":"4f8a9a79fcbb6ff595c6221a4a8afe42","url":"assets/icons/icon-144x144.png"},{"revision":"c42f8464727bfa88a34d08e09dbf96c7","url":"assets/icons/icon-152x152.png"},{"revision":"951b59e87e6e8f6f0bd50606ec39edc0","url":"assets/icons/icon-192x192.png"},{"revision":"7c6c28a10acaa2620f28ffe78e36e82f","url":"assets/icons/icon-384x384.png"},{"revision":"4e38e75335bad66256288a291f4968e3","url":"assets/icons/icon-48x48.png"},{"revision":"cb468b1affc75a04288016e354ba9105","url":"assets/icons/icon-512x512.png"},{"revision":"ac93f4ca4ee986ee879d4cb446dd7064","url":"assets/icons/icon-64x64.png"},{"revision":"6ba4f42ac7c42ccab359671b08c2fc2d","url":"assets/icons/icon-72x72.png"},{"revision":"731fda0ec7516eb4acc47b48bd85c966","url":"assets/icons/icon-96x96.png"},{"revision":"eaf8b9df4f77851c600fac517f56cc71","url":"assets/icons/icon-maskable-192x192.png"},{"revision":"c916ef18d2be711596fc739caa06548c","url":"assets/icons/icon-maskable-512x512.png"},{"revision":"662e422637df5581cc6402c56ed41091","url":"assets/icons/logo-high-res.png"},{"revision":"40e3816b483abb7ac0b056d37259311c","url":"assets/icons/old-logo.png"}]);
Pe();
d(
  new Ie(
    Ue("index.html"),
    { denylist: [/^\/api\//] }
  )
);
d(
  /\.html$/,
  new qe({
    cacheName: "wintoncoin-html-v1",
    networkTimeoutSeconds: 10,
    plugins: [
      new w({ maxEntries: 50, maxAgeSeconds: 86400 }),
      new b({ statuses: [0, 200] })
    ]
  })
);
d(
  /\/assets\/.*\.[A-Za-z0-9_-]{8,}\.(css|js)$/,
  new S({
    cacheName: "wintoncoin-assets-v1",
    plugins: [
      new w({ maxEntries: 100, maxAgeSeconds: 31536e3 }),
      new b({ statuses: [0, 200] })
    ]
  })
);
d(
  /\.(png|jpg|jpeg|svg|gif|ico|webp)$/,
  new S({
    cacheName: "wintoncoin-images-v1",
    plugins: [
      new w({ maxEntries: 100, maxAgeSeconds: 2592e3 }),
      new b({ statuses: [0, 200] })
    ]
  })
);
d(
  /\.(woff|woff2|ttf|otf)$/,
  new S({
    cacheName: "wintoncoin-fonts-v1",
    plugins: [
      new w({ maxEntries: 20, maxAgeSeconds: 31536e3 }),
      new b({ statuses: [0, 200] })
    ]
  })
);
d(
  /^https:\/\/fonts\.googleapis\.com/,
  new Me({
    cacheName: "google-fonts-stylesheets",
    plugins: [new w({ maxEntries: 10, maxAgeSeconds: 31536e3 })]
  })
);
d(
  /^https:\/\/fonts\.gstatic\.com/,
  new S({
    cacheName: "google-fonts-webfonts",
    plugins: [
      new w({ maxEntries: 30, maxAgeSeconds: 31536e3 }),
      new b({ statuses: [0, 200] })
    ]
  })
);
d(
  /\/api\//,
  new Ae({
    plugins: [new rt("wintoncoin-api-queue", { maxRetentionTime: 1440 })]
  })
);
d(
  /^https:\/\/cdn\.rawgit\.com/,
  new S({
    cacheName: "external-cdn",
    plugins: [
      new w({ maxEntries: 10, maxAgeSeconds: 2592e3 }),
      new b({ statuses: [0, 200] })
    ]
  })
);
self.addEventListener("push", (n) => {
  console.log("[SW] Push notification received");
  let e = {
    title: "WintonCoin",
    body: "Tienes una nueva notificación",
    icon: "/assets/icons/icon-192x192.png",
    badge: "/assets/icons/icon-72x72.png",
    tag: "wintoncoin-notification",
    data: { url: "/contract_interaction.html" }
  };
  if (n.data)
    try {
      const s = n.data.json();
      e = { ...e, ...s };
    } catch (s) {
      console.warn("[SW] Push data is not JSON, using as text:", s), e.body = n.data.text();
    }
  const t = {
    body: e.body,
    icon: e.icon,
    badge: e.badge,
    tag: e.tag,
    data: e.data,
    vibrate: [200, 100, 200],
    requireInteraction: !0,
    actions: [
      { action: "open", title: "Abrir" },
      { action: "dismiss", title: "Cerrar" }
    ]
  };
  n.waitUntil(
    self.registration.showNotification(e.title, t)
  );
});
self.addEventListener("notificationclick", (n) => {
  var t;
  if (console.log("[SW] Notification clicked"), n.notification.close(), n.action === "dismiss")
    return;
  const e = ((t = n.notification.data) == null ? void 0 : t.url) || "/contract_interaction.html";
  n.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: !0 }).then((s) => {
      for (const a of s)
        if (a.url.includes(self.location.origin) && "focus" in a)
          return a.url !== e && a.navigate(e).catch((i) => console.warn("[SW] Navigation failed:", i)), a.focus();
      if (clients.openWindow)
        return clients.openWindow(e);
    })
  );
});
self.addEventListener("sync", (n) => {
  console.log("[SW] Background sync triggered:", n.tag), n.tag === "sync-notifications" && n.waitUntil(Promise.resolve());
});
console.log("[SW] Service Worker loaded with Push Notifications support");
//# sourceMappingURL=sw-source.js.map
