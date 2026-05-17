// Strategy manager for CDSC WebView to keep loading fast while retaining fallbacks.

const STRATEGIES = {
  CACHED_LATEST: 'cached_latest',
  INCOGNITO_LATEST: 'incognito_latest',
  INCOGNITO_STABLE: 'incognito_stable',
};

class WebViewStrategyManager {
  constructor() {
    this.currentStrategy = STRATEGIES.CACHED_LATEST;
    this.retryCount = 0;
    this.maxRetries = 3;
    this.cachedChromeVersion = '120.0.6099.230';
  }

  async getLatestChromeVersion() {
    // Avoid an extra network call before every WebView mount. The fixed version is
    // browser-like enough for CDSC while keeping first paint fast.
    return this.cachedChromeVersion;
  }

  async getUserAgent() {
    const chromeVersion = await this.getLatestChromeVersion();

    switch (this.currentStrategy) {
      case STRATEGIES.INCOGNITO_STABLE:
        return 'Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
      case STRATEGIES.INCOGNITO_LATEST:
      case STRATEGIES.CACHED_LATEST:
      default:
        return `Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Mobile Safari/537.36`;
    }
  }

  getWebViewConfig() {
    switch (this.currentStrategy) {
      case STRATEGIES.CACHED_LATEST:
        return {
          cacheEnabled: true,
          incognito: false,
          description: 'Cached mode with latest Chrome',
        };
      case STRATEGIES.INCOGNITO_LATEST:
        return {
          cacheEnabled: false,
          incognito: true,
          description: 'Incognito mode with latest Chrome',
        };
      case STRATEGIES.INCOGNITO_STABLE:
        return {
          cacheEnabled: false,
          incognito: true,
          description: 'Incognito mode with stable Chrome',
        };
      default:
        return {
          cacheEnabled: true,
          incognito: false,
          description: 'Default cached mode',
        };
    }
  }

  switchToNextStrategy() {
    this.retryCount++;

    if (this.retryCount >= this.maxRetries) {
      console.log('[Strategy] Max retries reached');
      return false;
    }

    const strategies = Object.values(STRATEGIES);
    const currentIndex = strategies.indexOf(this.currentStrategy);
    const nextIndex = (currentIndex + 1) % strategies.length;

    this.currentStrategy = strategies[nextIndex];
    const config = this.getWebViewConfig();

    console.log(`[Strategy] Switching to: ${config.description} (Retry ${this.retryCount}/${this.maxRetries})`);
    return true;
  }

  resetStrategy() {
    console.log('[Strategy] Page loaded successfully, resetting retry count');
    this.retryCount = 0;
    this.currentStrategy = STRATEGIES.CACHED_LATEST;
  }

  getCurrentStrategyInfo() {
    const config = this.getWebViewConfig();
    return {
      strategy: this.currentStrategy,
      retryCount: this.retryCount,
      maxRetries: this.maxRetries,
      ...config,
    };
  }
}

export default new WebViewStrategyManager();
