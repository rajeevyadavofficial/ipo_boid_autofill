import { getApiBaseUrl } from '../utils/config';

const WEB_BACKEND_BASE = 'https://webbackend.cdsc.com.np/api';

// Helper for fetching through proxy on web to bypass CORS
// Returns a response-like object with .ok, .status, .json(), and .headers.get()
const proxyFetch = async (url, options = {}) => {
  try {
    const proxyUrl = `${getApiBaseUrl()}/proxy`;
    console.log(`🌐 [Web] Proxying: ${options.method || 'GET'} ${url}`);
    const raw = await fetch(proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        method: options.method || 'GET',
        headers: options.headers,
        body: options.body, // string, backend will parse it
      }),
    });

    // The proxy returns: { status, headers: {...}, data: ... }
    const envelope = await raw.json();

    // Build a response-like object the callers can use
    return {
      ok: envelope.status >= 200 && envelope.status < 300,
      status: envelope.status,
      headers: {
        get: (name) => (envelope.headers?.[name.toLowerCase()] ?? null),
      },
      json: async () => envelope.data,
    };
  } catch (e) {
    console.error('Proxy Fetch Error:', e);
    throw e;
  }
};

// Base64 Polyfills for decrypting/encoding
const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
const atob = (input = '') => {
  let str = input.replace(/=+$/, '');
  let output = '';
  if (str.length % 4 === 1) throw new Error("'atob' failed");
  for (let bc = 0, bs, buffer, i = 0;
    buffer = str.charAt(i++);
    ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer,
      bc++ % 4) ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0) {
    buffer = chars.indexOf(buffer);
  }
  return output;
};

const decrypt = (encoded) => {
  try { return atob(encoded); } catch { return encoded; }
};

const defaultHeaders = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Content-Type': 'application/json',
  'Origin': 'https://meroshare.cdsc.com.np',
  'Referer': 'https://meroshare.cdsc.com.np/',
};

export const MeroShareApi = {
  /**
   * Login to MeroShare
   * @returns {Promise<string|null>} Token
   */
  login: async (clientId, username, password) => {
    try {
      const response = await proxyFetch(`${WEB_BACKEND_BASE}/meroShare/auth/`, {
        method: 'POST',
        headers: { ...defaultHeaders, 'Authorization': 'null' },
        body: JSON.stringify({ clientId: clientId.toString(), username, password }),
      });

      if (response.ok) {
        return response.headers.get('Authorization');
      }
    } catch (e) {
      console.warn('MeroShare Login Error:', e.message);
    }
    return null;
  },

  /**
   * Fetch full account details (BOID, Bank ID, etc.)
   * Mirrors the exact Flutter fetchAccountDetails flow.
   */
  fetchDetails: async (token) => {
    const headers = { ...defaultHeaders, 'Authorization': token };
    try {
      // Step 1: Get own detail to obtain the 16-digit DMAT number
      const ownRes = await proxyFetch(`${WEB_BACKEND_BASE}/meroShare/ownDetail/`, { headers });
      const ownData = await ownRes.json();
      const dmat = ownData.demat;
      if (!dmat) throw new Error('Could not retrieve DMAT from ownDetail');

      // Step 2: Get myDetail using DMAT to get bankCode and name (Flutter: /meroShareView/myDetail/{dmat})
      const detailRes = await proxyFetch(`${WEB_BACKEND_BASE}/meroShareView/myDetail/${dmat}`, { headers });
      const detailData = await detailRes.json();
      const bankCode = detailData.bankCode;
      if (!bankCode) throw new Error('Could not retrieve bankCode from myDetail');

      // Step 3: Get Bank Request (Account Number)
      const bankReqRes = await proxyFetch(`${WEB_BACKEND_BASE}/bankRequest/${bankCode}`, { headers });
      const bankReqData = await bankReqRes.json();
      const accountNumber = bankReqData.accountNumber;

      // Step 4: Get User Bank list → Bank ID
      const bankRes = await proxyFetch(`${WEB_BACKEND_BASE}/meroShare/bank/`, { headers });
      const bankListData = await bankRes.json();
      const bankData = Array.isArray(bankListData) ? bankListData[0] : bankListData;
      const bankId = bankData.id.toString();

      // Step 5: Get Bank Specifics (Branch ID, Customer ID, Account Type)
      const bankSpecRes = await proxyFetch(`${WEB_BACKEND_BASE}/meroShare/bank/${bankId}`, { headers });
      const bankSpecListData = await bankSpecRes.json();
      const bankSpecData = Array.isArray(bankSpecListData) ? bankSpecListData[0] : bankSpecListData;

      return {
        dmat,
        accountNumber,
        bankId,
        branchId: bankSpecData.accountBranchId?.toString(),
        customerId: bankSpecData.id?.toString(),
        accountTypeId: bankSpecData.accountTypeId?.toString(),
      };
    } catch (e) {
      console.warn('Fetch Details Error:', e.message);
      return null;
    }
  },

  /**
   * Apply for an IPO
   */
  apply: async (token, payload) => {
    try {
      const response = await proxyFetch(`${WEB_BACKEND_BASE}/meroShare/applicantForm/share/apply`, {
        method: 'POST',
        headers: {
            ...defaultHeaders,
            'Authorization': token,
            'Pragma': 'no-cache',
            'Cache-Control': 'no-cache'
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      return {
        success: response.status === 201,
        message: data.message || (response.status === 201 ? 'Success' : 'Failed'),
      };
    } catch (e) {
      return { success: false, message: e.message };
    }
  },

  /**
   * Fetch currently open IPOs/Issues (using the application-ready list)
   */
  fetchOpenIpos: async (token) => {
    try {
      const response = await proxyFetch(`${WEB_BACKEND_BASE}/meroShare/companyShare/applicableIssue/`, {
        method: 'POST',
        headers: { ...defaultHeaders, 'Authorization': token },
        body: JSON.stringify({
          "filterFieldParams": [],
          "page": 1,
          "size": 10,
          "searchRoleViewConstants": "VIEW_APPLICABLE_SHARE",
          "filterDateParams": [
            {"key": "minIssueOpenDate", "condition": "", "alias": "", "value": ""},
            {"key": "maxIssueCloseDate", "condition": "", "alias": "", "value": ""}
          ]
        })
      });
      const data = await response.json();
      const list = data.object || [];

      // Map to consistent format
      return list.map(item => ({
        companyShareId: item.companyShareId,
        companyName: item.companyName,
        shareTypeName: item.shareTypeName,
        closeDate: item.closeDate,
        minKitta: item.minKitta || 10
      }));
    } catch (e) {
      console.warn('Fetch Issues Error:', e.message);
      return [];
    }
  },

  /**
   * Fetch active applications to check if already applied
   */
  fetchActiveApplications: async (token) => {
    try {
      const response = await proxyFetch(`${WEB_BACKEND_BASE}/meroShare/applicantForm/active/search/`, {
        method: 'POST',
        headers: { ...defaultHeaders, 'Authorization': token },
        body: JSON.stringify({
          filterFieldParams: [],
          page: 1,
          size: 200,
          searchRoleViewConstants: 'VIEW_APPLICANT_FORM_COMPLETE',
          filterDateParams: []
        })
      });
      const data = await response.json();
      return data.object || [];
    } catch (e) {
      console.warn('Fetch Active Apps Error:', e.message);
      return [];
    }
  },

  /**
   * Logout
   */
  logout: async (token) => {
    try {
      await proxyFetch(`${WEB_BACKEND_BASE}/meroShare/auth/logout/`, {
        headers: { ...defaultHeaders, 'Authorization': token },
      });
    } catch (_) {}
  },

  /**
   * Fetch ALL account data (portfolio, applications, holdings, etc.)
   * Used by the Account Dashboard screen.
   */
  fetchAllAccountData: async (token) => {
    const h = { ...defaultHeaders, Authorization: token };
    const result = {};

    const safe = async (key, fn) => {
      try { result[key] = await (await fn()).json(); }
      catch (e) { result[key] = null; }
    };

    // Get DMAT first via ownDetail
    await safe('ownDetail', () => proxyFetch(`${WEB_BACKEND_BASE}/meroShare/ownDetail/`, { headers: h }));
    const dmat = result.ownDetail?.demat;

    if (dmat) {
      await safe('myDetail', () => proxyFetch(`${WEB_BACKEND_BASE}/meroShareView/myDetail/${dmat}`, { headers: h }));
    }
    const bankCode = result.myDetail?.bankCode;
    if (bankCode) {
      await safe('bankRequest', () => proxyFetch(`${WEB_BACKEND_BASE}/bankRequest/${bankCode}`, { headers: h }));
    }

    await safe('bankList', () => proxyFetch(`${WEB_BACKEND_BASE}/meroShare/bank/`, { headers: h }));
    const bankId = Array.isArray(result.bankList) ? result.bankList[0]?.id : null;
    if (bankId) {
      await safe('bankDetails', () => proxyFetch(`${WEB_BACKEND_BASE}/meroShare/bank/${bankId}`, { headers: h }));
    }

    // Applications
    await safe('applicationReport', () => proxyFetch(`${WEB_BACKEND_BASE}/meroShare/applicantForm/active/search/`, {
      method: 'POST', headers: h,
      body: JSON.stringify({ filterFieldParams: [], page: 1, size: 200, searchRoleViewConstants: 'VIEW_APPLICANT_FORM_COMPLETE', filterDateParams: [] }),
    }));
    await safe('oldApplicationReport', () => proxyFetch(`${WEB_BACKEND_BASE}/meroShare/migrated/applicantForm/search/`, {
      method: 'POST', headers: h,
      body: JSON.stringify({ filterFieldParams: [], page: 1, size: 200, searchRoleViewConstants: 'VIEW_APPLICANT_FORM_COMPLETE', filterDateParams: [] }),
    }));

    // Deep Verification Logic: Fetch detailed report for accurate allotment status
    const allItems = [
      ...(result.applicationReport?.object || []),
      ...(result.oldApplicationReport?.object || []),
    ];

    if (allItems.length > 0) {
      const needsDetail = allItems.filter(i => i.statusName === 'TRANSACTION_SUCCESS');
      const detailedResults = new Map();

      // Fetch in small concurrent batches to avoid WAF
      const fetchBatchSize = 10;
      for (let i = 0; i < needsDetail.length; i += fetchBatchSize) {
        const batch = needsDetail.slice(i, i + fetchBatchSize);
        await Promise.all(batch.map(async (item) => {
          try {
            const detailRes = await proxyFetch(`${WEB_BACKEND_BASE}/meroShare/applicantForm/report/detail/${item.applicantFormId}`, { headers: h });
            const detailData = await detailRes.json();
            detailedResults.set(item.applicantFormId, detailData);
          } catch (e) {
            console.warn(`Failed detail fetch for ${item.applicantFormId}`);
          }
        }));
        if (i + fetchBatchSize < needsDetail.length) {
          await new Promise(r => setTimeout(r, 400));
        }
      }

      // Map and classify
      const verifiedApps = allItems.map(item => {
        const detail = detailedResults.get(item.applicantFormId);
        let realStatus = (detail?.statusName || item.statusName || '').toUpperCase();
        let cat = 'other';

        if (realStatus.includes('NOT ALLOTED') || realStatus.includes('NOT ALLOTTED')) cat = 'not_allotted';
        else if (realStatus.includes('ALLOTED') || realStatus.includes('ALLOTTED')) cat = 'allotted';
        else if (realStatus.includes('FAILED') || realStatus.includes('REJECTED')) cat = 'bank_failed';
        else if (realStatus.includes('PROCESS') || realStatus.includes('APPROVE') || realStatus.includes('VERIFIED')) cat = 'pending';

        return {
          ...item,
          statusName: detail?.statusName || item.statusName,
          receivedKitta: detail?.receivedKitta || 0,
          appliedKitta: detail?.appliedKitta || item.appliedKitta,
          category: cat,
          remark: detail?.reasonOrRemark || detail?.meroshareRemark || '',
        };
      });

      const allotted = verifiedApps.filter(a => a.category === 'allotted').length;
      const notAllotted = verifiedApps.filter(a => a.category === 'not_allotted').length;
      const pending = verifiedApps.filter(a => a.category === 'pending').length;
      const bankFailed = verifiedApps.filter(a => a.category === 'bank_failed').length;
      const completed = allotted + notAllotted;
      const successRate = completed > 0 ? Math.round((allotted / completed) * 100) : 0;

      result.verifiedStats = { total: verifiedApps.length, allotted, notAllotted, pending, bankFailed, successRate };
      result.verifiedApplications = verifiedApps;
    }

    // Portfolio
    await safe('myShares', () => proxyFetch(`${WEB_BACKEND_BASE}/meroShare/meroShareMyShare/myShare/`, {
      method: 'POST', headers: h,
      body: JSON.stringify({ filterFieldParams: [], page: 1, size: 200, searchRoleViewConstants: 'VIEW_MY_SHARE', filterDateParams: [] }),
    }));
    await safe('portfolio', () => proxyFetch(`${WEB_BACKEND_BASE}/meroShare/meroShareMyPortfolio/myPortfolio/`, { headers: h }));
    await safe('transactionHistory', () => proxyFetch(`${WEB_BACKEND_BASE}/meroShare/meroShareMyTransaction/myTransaction/`, {
      method: 'POST', headers: h,
      body: JSON.stringify({ filterFieldParams: [], page: 1, size: 50, searchRoleViewConstants: 'VIEW_MY_TRANSACTION', filterDateParams: [] }),
    }));

    return result;
  },
};
