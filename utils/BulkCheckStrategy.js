// Bulk IPO Check Strategy
// Automated checking of IPO results with Gemini-powered captcha solving

import { getApiBaseUrl } from './config';

/**
 * Generate JavaScript code to check IPO result for a single BOID
 * @param {string} ipoName - Name of the IPO company
 * @param {string} boid - 16-digit BOID number
 * @returns {string} - JavaScript code to inject into WebView
 */
export const generateBulkCheckScript = (ipoName, boid) => {
  const API_URL = getApiBaseUrl();
  
  return `
(async function checkIPOResult() {
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  
  try {
    console.log('🔍 Starting IPO check for BOID: ${boid}');
    
    // Step 1: Clear previous selection
    const clearBtn = document.querySelector('.ng-clear-wrapper');
    if (clearBtn) {
      clearBtn.click();
      await sleep(300);
    }
    
    // Step 2: Select company from ng-select dropdown
    const input = document.querySelector('#companyShare input');
    if (!input) throw new Error('Company dropdown not found');
    
    input.focus();
    input.click();
    input.value = '${ipoName}';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(1000);
    
    // Find and click matching option
    const options = document.querySelectorAll('.ng-option');
    const matchingOption = Array.from(options).find(opt => 
      opt.innerText.includes('${ipoName}')
    );
    
    if (!matchingOption) {
      throw new Error('Company "${ipoName}" not found in dropdown');
    }
    
    matchingOption.click();
    await sleep(500);
    
    // Step 3: Extract captcha image (Base64)
    const captchaImg = document.querySelector('img[alt="captcha"]');
    if (!captchaImg) throw new Error('Captcha image not found');
    
    const base64Image = captchaImg.src.split(',')[1];
    if (!base64Image) throw new Error('Failed to extract captcha image');
    
    console.log('📸 Captcha image extracted, sending to Gemini...');
    
    // Step 4: Solve captcha using Gemini API
    const captchaResponse = await fetch('${API_URL}/api/captcha/solve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64: base64Image })
    });
    
    const captchaData = await captchaResponse.json();
    
    if (!captchaData.success) {
      throw new Error('Captcha solving failed: ' + (captchaData.error || 'Unknown error'));
    }
    
    console.log('✅ Captcha solved:', captchaData.captchaText);
    
    // Step 5: Fill BOID
    const boidInput = document.querySelector('#boid');
    if (!boidInput) throw new Error('BOID input not found');
    boidInput.value = '${boid}';
    
    // Step 6: Fill captcha
    const captchaInput = document.querySelector('#userCaptcha');
    if (!captchaInput) throw new Error('Captcha input not found');
    captchaInput.value = captchaData.captchaText;
    
    // Step 7: Submit form
    const submitBtn = document.querySelector('button[type="submit"]');
    if (!submitBtn) throw new Error('Submit button not found');
    submitBtn.click();
    
    console.log('📤 Form submitted, waiting for result...');
    await sleep(2500);
    
    // Step 8: Check for captcha error
    const errorMsg = document.querySelector('p.text-danger.text-center');
    if (errorMsg && errorMsg.innerText.includes('Invalid Captcha')) {
      throw new Error('Invalid captcha - needs retry');
    }
    
    // Step 9: Parse result
    const bodyText = document.body.innerText;
    
    // Exact text patterns:
    // Allotted: "Congratulation Alloted !!! Alloted quantity : 10"
    // Not Allotted: "Sorry, not alloted for the entered BOID."
    const isAllotted = bodyText.includes('Congratulation Alloted !!!');
    const sharesMatch = bodyText.match(/Alloted quantity\\s*:\\s*(\\d+)/i);
    const shares = sharesMatch ? parseInt(sharesMatch[1]) : 0;
    
    console.log('✅ Result parsed:', isAllotted ? 'ALLOTTED' : 'NOT ALLOTTED');
    
    // Step 10: Send result back to React Native
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'BULK_CHECK_RESULT',
      boid: '${boid}',
      status: isAllotted ? 'allotted' : 'not-allotted',
      shares: shares,
      success: true,
      timestamp: new Date().toISOString()
    }));
    
  } catch (error) {
    console.error('❌ Check failed:', error.message);
    
    // Send error back to React Native
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'BULK_CHECK_RESULT',
      boid: '${boid}',
      status: 'error',
      error: error.message,
      success: false,
      timestamp: new Date().toISOString()
    }));
  }
})();
`;
};

/**
 * Reload the IPO result page to get a fresh captcha
 * @returns {string} - JavaScript code to reload page
 */
export const reloadForFreshCaptcha = () => {
  return `
window.location.reload();
true; // Return true to indicate reload initiated
`;
};

/**
 * Extract list of available IPOs from the website's dropdown
 * @returns {string} - JavaScript code to extract IPO list
 */
export const extractIPOListFromWebsite = () => {
  return `
(function() {
  try {
    // Click the ng-select to open the dropdown
    const ngSelect = document.querySelector('#companyShare');
    if (!ngSelect) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'IPO_LIST_RESULT',
        success: false,
        error: 'Company dropdown not found'
      }));
      return;
    }

    const input = ngSelect.querySelector('input');
    input.focus();
    input.click();

    // Wait a bit for the dropdown to populate
    setTimeout(() => {
      const options = document.querySelectorAll('.ng-option');
      
      if (options.length === 0) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'IPO_LIST_RESULT',
          success: false,
          error: 'No IPOs found in dropdown'
        }));
        return;
      }

      // Extract company names from all options
      const companies = Array.from(options).map(opt => opt.innerText.trim());
      
      // Close the dropdown
      document.querySelector('.ng-clear-wrapper')?.click();
      
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'IPO_LIST_RESULT',
        success: true,
        companies: companies
      }));
    }, 1000);
  } catch (error) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'IPO_LIST_RESULT',
      success: false,
      error: error.message
    }));
  }
})();
`;
};

/**
 * Fetch company list directly from the IPO result API
 * This is the MOST RELIABLE way - calls the endpoint directly
 * @returns {string} - JavaScript code to fetch company data
 */
export const fetchIPOsDirectly = () => {
  return `
(async function() {
  try {
    console.log('🔄 Fetching company list from API...');
    
    const response = await fetch('https://iporesult.cdsc.com.np/result/companyShares/fileUploaded', {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });

    if (!response.ok) {
      throw new Error('API request failed with status ' + response.status);
    }

    const data = await response.json();
    
    if (!Array.isArray(data)) {
      throw new Error('Invalid API response format');
    }

    // Filter valid companies and map to our format
    const companies = data
      .filter(c => c.id && c.name)
      .map(c => ({
        id: c.id,
        name: c.name,
        scrip: c.scrip || ''
      }));

    console.log('✅ Fetched ' + companies.length + ' companies');

    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'COMPANY_LIST_RESULT',
      success: true,
      companies: companies
    }));

  } catch (error) {
    console.error('❌ Fetch failed:', error.message);
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'COMPANY_LIST_RESULT',
      success: false,
      error: error.message
    }));
  }
})();
`;
};

