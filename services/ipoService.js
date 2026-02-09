import { getApiBaseUrl } from '../utils/config';

// Fallback mock data in case backend is unavailable
const MOCK_IPOS = [
  // Open IPOs
  {
    id: '1',
    company: 'Reliance Spinning Mills Ltd.',
    type: 'IPO (Book Building)',
    units: '10,14,000',
    price: 'Rs. 820.80',
    status: 'Open',
    openingDate: '2024-11-28',
    closingDate: '2024-12-05',
  },
  {
    id: '2',
    company: 'Nepal Infrastructure Bank Limited',
    type: 'IPO',
    units: '1,50,00,000',
    price: 'Rs. 100',
    status: 'Open',
    openingDate: '2024-11-25',
    closingDate: '2024-12-02',
  },
  {
    id: '3',
    company: 'Sunrise Bluechip Fund',
    type: 'Mutual Fund',
    units: '50,00,000',
    price: 'Rs. 10',
    status: 'Open',
    openingDate: '2024-11-30',
    closingDate: '2024-12-10',
  },
  
  // Upcoming IPOs
  {
    id: '4',
    company: 'Sarbottam Cement Limited',
    type: 'IPO (Book Building)',
    units: '24,00,000',
    price: 'Rs. 360.90',
    status: 'Upcoming',
    openingDate: '2024-12-15',
    closingDate: '2024-12-20',
  },
  {
    id: '5',
    company: 'Himalayan Power Partner Ltd.',
    type: 'FPO',
    units: '80,00,000',
    price: 'Rs. 250',
    status: 'Upcoming',
    openingDate: '2024-12-08',
    closingDate: '2024-12-12',
  },
  {
    id: '6',
    company: 'Sanima Mai Hydropower Ltd.',
    type: 'Right Share',
    units: '1,20,00,000',
    price: 'Rs. 100',
    status: 'Upcoming',
    openingDate: '2024-12-20',
    closingDate: '2024-12-28',
  },
  
  // Closed IPOs
  {
    id: '7',
    company: 'Himalayan Reinsurance Limited',
    type: 'IPO',
    units: '2,49,00,000',
    price: 'Rs. 206',
    status: 'Closed',
    openingDate: '2023-12-13',
    closingDate: '2023-12-17',
  },
  {
    id: '8',
    company: 'Laxmi Sunrise Bank Limited',
    type: 'Right Share',
    units: '3,00,00,000',
    price: 'Rs. 100',
    status: 'Closed',
    openingDate: '2024-10-20',
    closingDate: '2024-10-25',
  },
  {
    id: '9',
    company: 'Citizen Investment Trust',
    type: 'IPO',
    units: '5,00,00,000',
    price: 'Rs. 100',
    status: 'Closed',
    openingDate: '2024-11-01',
    closingDate: '2024-11-08',
  },
  {
    id: '10',
    company: 'NMB Microfinance Bittiya Sanstha Ltd.',
    type: 'Debenture',
    units: '75,00,000',
    price: 'Rs. 1000',
    status: 'Closed',
    openingDate: '2024-11-15',
    closingDate: '2024-11-22',
  },
];

export const getUpcomingIpos = async () => {
  try {
    const API_URL = getApiBaseUrl();
    // Try to fetch from backend API
    const response = await fetch(`${API_URL}/ipos`);
    
    if (!response.ok) {
      throw new Error(`Backend API returned ${response.status}`);
    }
    
    const rawText = await response.text();
    let data;
    try {
      data = JSON.parse(rawText);
    } catch (e) {
      console.error(`❌ [IPO Service] JSON Parse error. Status: ${response.status}`);
      console.error(`❌ [IPO Service] Response snippet: ${rawText.substring(0, 100)}`);
      throw new Error(`Server at ${API_URL} returned HTML instead of JSON. Check backend status.`);
    }
    
    if (data.success && data.data) {
      console.log('✅ Fetched IPOs from backend');
      return data.data;
    }
    
    throw new Error('Invalid response from backend');
    
  } catch (error) {
    console.warn('⚠️  Backend unavailable, using mock data:', error.message);
    
    // Fallback to mock data
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(MOCK_IPOS);
      }, 500);
    });
  }
};
