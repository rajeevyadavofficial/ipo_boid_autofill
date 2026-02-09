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
    
    // Step 3: Extract captcha image with 300% High-Precision Scaling
    const captchaImg = document.querySelector('img[alt="captcha"]');
    if (!captchaImg) throw new Error('Captcha image not found');
    
    const scale = 3;
    const canvas = document.createElement('canvas');
    canvas.width = (captchaImg.naturalWidth || captchaImg.width) * scale;
    canvas.height = (captchaImg.naturalHeight || captchaImg.height) * scale;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(captchaImg, 0, 0, canvas.width, canvas.height);
    
    const base64Image = canvas.toDataURL('image/png', 1.0).split(',')[1];
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
 * Generate JavaScript to select a company in the dropdown
 */
export const generateCompanySelectionScript = (ipoName) => {
  return `
(async function selectCompany() {
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  try {
    console.log('🏢 Selecting company: ${ipoName}');
    
    // 1. Clear previous
    const clearBtn = document.querySelector('.ng-clear-wrapper');
    if (clearBtn) {
      clearBtn.click();
      await sleep(300);
    }
    
    // 2. Focus and Fill
    const input = document.querySelector('#companyShare input');
    if (!input) throw new Error('Dropdown not found');
    
    input.focus();
    input.click();
    input.value = '${ipoName}';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(1000);
    
    // 3. Find match
    const options = document.querySelectorAll('.ng-option');
    const matchingOption = Array.from(options).find(opt => 
      opt.innerText.toLowerCase().includes('${ipoName}'.toLowerCase())
    );
    
    if (matchingOption) {
      matchingOption.click();
      console.log('✅ Company selected');
    } else {
      console.warn('⚠️ Company not found in list');
    }
  } catch (e) {
    console.error('Selection error:', e.message);
  }
})();
true;
`;
};

/**
 * Step 1: Extract Captcha Image
 * Uses "Surgical Refresh" - only clicks the captcha image if requested, no page reloads.
 */
export const generateCaptchaExtractionScript = (boid, shouldRefresh) => {
  return `
(async function extractSurgical() {
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  
  try {
    console.log('🔍 Surgical Extraction for BOID: ${boid} (Refresh: ${shouldRefresh})');
    
    // 1. Surgical Refresh: Precise logic from Harvest Mode
    if (${shouldRefresh}) {
      console.log('🔄 Triggering captcha refresh...');
      const captchaImg = document.querySelector('img[alt="captcha"]');
      if (captchaImg) {
        const oldSrc = captchaImg.src;
        
        // Try specific refresh button first
        const reloadBtn = document.querySelector('button[tooltip="Reload Captcha"]') || 
                          document.querySelector('button i.fa-refresh')?.parentElement;
        
        if (reloadBtn) {
          console.log('🎯 Found Reload button');
          reloadBtn.click();
        } else {
          console.log('⚠️ Fallback: Clicking image to refresh');
          captchaImg.click();
        }
        
        // Wait for image change
        let waitAttempts = 0;
        while (captchaImg.src === oldSrc && waitAttempts < 15) {
          await sleep(200);
          waitAttempts++;
        }
        console.log('✅ Fresh captcha loaded');
      }
    }
    
    // 2. Extract image data with 300% High-Precision Scaling
    const finalImg = document.querySelector('img[alt="captcha"]');
    if (!finalImg) throw new Error('Captcha image not found');
    
    // Create a high-res canvas (3x scale)
    const scale = 3;
    const canvas = document.createElement('canvas');
    canvas.width = (finalImg.naturalWidth || finalImg.width) * scale;
    canvas.height = (finalImg.naturalHeight || finalImg.height) * scale;
    const ctx = canvas.getContext('2d');
    
    // Disable smoothing to keep edges sharp for AI OCR
    ctx.imageSmoothingEnabled = false;
    ctx.webkitImageSmoothingEnabled = false;
    ctx.mozImageSmoothingEnabled = false;
    
    // Draw enlarged image
    ctx.drawImage(finalImg, 0, 0, canvas.width, canvas.height);
    
    // Convert canvas to blob (more efficient than direct base64)
    canvas.toBlob((blob) => {
      if (!blob) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'BULK_CHECK_RESULT',
          boid: '${boid}',
          status: 'error',
          error: 'Failed to create blob from canvas',
          success: false
        }));
        return;
      }
      
      console.log('📦 Blob created:', blob.size, 'bytes, type:', blob.type);
      
      // Convert blob to base64 for transmission via postMessage
      // (WebView postMessage only accepts strings)
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Data = reader.result.split(',')[1];
        
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'CAPTCHA_IMAGE_READY',
          boid: '${boid}',
          imageBase64: base64Data,
          imageSize: blob.size,
          mimeType: blob.type
        }));
      };
      reader.onerror = () => {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'BULK_CHECK_RESULT',
          boid: '${boid}',
          status: 'error',
          error: 'Failed to read blob as base64',
          success: false
        }));
      };
      reader.readAsDataURL(blob);
    }, 'image/png', 1.0);

  } catch (error) {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'BULK_CHECK_RESULT',
      boid: '${boid}',
      status: 'error',
      error: 'Extraction: ' + error.message,
      success: false
    }));
  }
})();
`;
};

/**
 * Step 2: Fill BOID/Captcha and Submit
 */
export const generateFinalSubmissionScript = (boid, captchaText) => {
  return `
(async function submitFinal() {
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  
  try {
    console.log('📥 Submitting for BOID: ${boid}');
    
    const boidInput = document.querySelector('#boid');
    const captchaInput = document.querySelector('#userCaptcha');
    
    // Find button by type or text
    let submitBtn = document.querySelector('button[type="submit"]');
    if (!submitBtn) {
      const buttons = Array.from(document.querySelectorAll('button'));
      submitBtn = buttons.find(b => b.innerText.includes('View Result'));
    }
    
    if (!boidInput || !captchaInput || !submitBtn) throw new Error('Form elements missing');

    // Fill BOID
    boidInput.value = '${boid}';
    boidInput.dispatchEvent(new Event('input', { bubbles: true }));
    
    // Fill Captcha
    captchaInput.value = '${captchaText}';
    captchaInput.dispatchEvent(new Event('input', { bubbles: true }));
    
    console.log('⏳ Waiting for input processing...');
    await sleep(800); // Wait for Angular to catch up
    
    submitBtn.click();
    
    console.log('📤 Form submitted, waiting for response...');
    
    // Wait for response - the page will show either a modal or inline message
    await sleep(4000);
    
    // === COMPREHENSIVE TEXT EXTRACTION ===
    const getAllVisibleText = () => {
      const elements = document.querySelectorAll('p, div, span, h1, h2, b, i, .text-danger, .modal-body');
      const visibleTexts = [];
      
      elements.forEach(el => {
        if (el.offsetParent === null) return; // Hidden
        const text = el.textContent.trim();
        if (text && text.length > 0 && !visibleTexts.includes(text)) {
          visibleTexts.push(text);
        }
      });
      
      return visibleTexts.join(' | ');
    };
    
    const allVisibleText = getAllVisibleText();
    const lowerText = allVisibleText.toLowerCase();
    
    console.log('📋 Full Text:', allVisibleText);
    
    // === 1. DETECT ERROR (RETRYABLE) ===
    // User provided exact pattern: <b ...>Invalid Captcha Provided. Please try again </b>
    const errorKeywords = ['invalid captcha', 'incorrect', 'try again', 'mismatch', 'wrong'];
    const hasError = errorKeywords.some(word => lowerText.includes(word));
    
    if (hasError) {
      // Find the specific error fragment
      const fragments = allVisibleText.split('|');
      const errorMsg = fragments.find(f => errorKeywords.some(w => f.toLowerCase().includes(w))) || 'Invalid Captcha Provided. Please try again';
      
      console.log('🚫 Submission Error:', errorMsg);
      // We throw "Captcha Error" to signal BulkCheckPanel.js to increment attempts and refresh
      throw new Error('Captcha Error: ' + errorMsg.trim());
    }
    
    // === 2. DETECT ALLOTTED ===
    if (lowerText.includes('congratulation') || lowerText.includes('alloted')) {
      const sharesMatch = allVisibleText.match(/(\d+)\s*shares?/i) || allVisibleText.match(/quantity\s*:?\s*(\d+)/i);
      const shares = sharesMatch ? parseInt(sharesMatch[1]) : 0;
      
      const message = allVisibleText.match(/congratulation[^|]*/i)?.[0] || '🎉 Allotted';
      
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'BULK_CHECK_RESULT',
        boid: '${boid}',
        status: 'allotted',
        shares: shares,
        message: message.trim(),
        success: true,
        timestamp: new Date().toISOString()
      }));
      return;
    }
    
    // === 3. DETECT NOT ALLOTTED ===
    if (lowerText.includes('not alloted') || lowerText.includes('sorry')) {
      const message = allVisibleText.match(/sorry[^|]*/i)?.[0] || '❌ Not allotted';
      
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'BULK_CHECK_RESULT',
        boid: '${boid}',
        status: 'not-allotted',
        message: message.trim(),
        success: true,
        timestamp: new Date().toISOString()
      }));
      return;
    }
    
    // === 4. FALLBACK ===
    const cleanText = allVisibleText.replace(/Check Share Result|Select company|View Result/g, '').replace(/\|/g, ' ').trim();
    throw new Error('Captcha Error (Unknown Response): ' + cleanText.substring(0, 200));

  } catch (error) {
    console.error('Submission error:', error.message);
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'BULK_CHECK_RESULT',
      boid: '${boid}',
      status: 'error',
      error: error.message,
      success: false
    }));
  }
})();
`;
};

/**
 * Reload the IPO result page to get a fresh captcha
 */
export const reloadForFreshCaptcha = () => {
  return `window.location.reload(); true;`;
};


