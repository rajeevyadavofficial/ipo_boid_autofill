// utils/WebViewStrategies.js
// Strategy manager for CDSC WebView to handle different loading strategies

const STRATEGIES = {
  INCOGNITO_LATEST: 'incognito_latest',
  CACHED_LATEST: 'cached_latest',
  INCOGNITO_STABLE: 'incognito_stable',
};

class WebViewStrategyManager {
  constructor() {
    this.currentStrategy = STRATEGIES.INCOGNITO_LATEST;
    this.retryCount = 0;
    this.maxRetries = 3;
  }

  // Get the latest Chrome version (fallback to hardcoded if fetch fails)
  async getLatestChromeVersion() {
    try {
      // Try to fetch latest version from a public API
      const response = await fetch('https://versionhistory.googleapis.com/v1/chrome/platforms/android/channels/stable/versions/all/releases?filter=fraction>=0.5', {
        timeout: 3000
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.releases && data.releases.length > 0) {
          const version = data.releases[0].version;
          console.log('✅ [Strategy] Fetched latest Chrome version:', version);
          return version;
        }
      }
    } catch (error) {
      console.log('⚠️ [Strategy] Failed to fetch Chrome version, using fallback');
    }
    
    // Fallback to a recent stable version
    return '120.0.6099.230';
  }

  // Get User-Agent for current strategy
  async getUserAgent() {
    const chromeVersion = await this.getLatestChromeVersion();
    
    switch (this.currentStrategy) {
      case STRATEGIES.INCOGNITO_LATEST:
      case STRATEGIES.CACHED_LATEST:
        return `Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Mobile Safari/537.36`;
      
      case STRATEGIES.INCOGNITO_STABLE:
        // Use a known stable version as fallback
        return `Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36`;
      
      default:
        return `Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Mobile Safari/537.36`;
    }
  }

  // Get WebView configuration for current strategy
  getWebViewConfig() {
    switch (this.currentStrategy) {
      case STRATEGIES.INCOGNITO_LATEST:
        return {
          cacheEnabled: false,
          incognito: true,
          description: 'Incognito mode with latest Chrome'
        };
      
      case STRATEGIES.CACHED_LATEST:
        return {
          cacheEnabled: true,
          incognito: false,
          description: 'Cached mode with latest Chrome'
        };
      
      case STRATEGIES.INCOGNITO_STABLE:
        return {
          cacheEnabled: false,
          incognito: true,
          description: 'Incognito mode with stable Chrome'
        };
      
      default:
        return {
          cacheEnabled: false,
          incognito: true,
          description: 'Default incognito mode'
        };
    }
  }

  // Switch to next strategy on failure
  switchToNextStrategy() {
    this.retryCount++;
    
    if (this.retryCount >= this.maxRetries) {
      console.log('❌ [Strategy] Max retries reached');
      return false;
    }

    const strategies = Object.values(STRATEGIES);
    const currentIndex = strategies.indexOf(this.currentStrategy);
    const nextIndex = (currentIndex + 1) % strategies.length;
    
    this.currentStrategy = strategies[nextIndex];
    const config = this.getWebViewConfig();
    
    console.log(`🔄 [Strategy] Switching to: ${config.description} (Retry ${this.retryCount}/${this.maxRetries})`);
    return true;
  }

  // Reset strategy on success
  resetStrategy() {
    console.log('✅ [Strategy] Page loaded successfully, resetting retry count');
    this.retryCount = 0;
    this.currentStrategy = STRATEGIES.INCOGNITO_LATEST;
  }

  // Get current strategy info
  getCurrentStrategyInfo() {
    const config = this.getWebViewConfig();
    return {
      strategy: this.currentStrategy,
      retryCount: this.retryCount,
      maxRetries: this.maxRetries,
      ...config
    };
  }
}

export default new WebViewStrategyManager();
