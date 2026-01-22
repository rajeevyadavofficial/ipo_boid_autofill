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
