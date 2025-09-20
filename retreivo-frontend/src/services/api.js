// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Helper function to get auth headers
const getAuthHeaders = (token, isMultipart = false) => {
  // Prioritize passed token, then fallback to localStorage
  const authToken = token || localStorage.getItem('token');
  
  if (!authToken) {
    console.warn('No authentication token available');
  }
  
  return {
    ...(!isMultipart && { 'Content-Type': 'application/json' }),
    ...(authToken && { 'Authorization': `Bearer ${authToken}` })
  };
};

// Email configuration
const EMAIL_ENABLED = import.meta.env.VITE_EMAIL_ENABLED === 'true';
const EMAIL_SERVICE = import.meta.env.VITE_EMAIL_SERVICE || 'default';
const EMAIL_USER = import.meta.env.VITE_EMAIL_USER;
const EMAIL_PASSWORD = import.meta.env.VITE_EMAIL_PASSWORD;

// Helper function to handle API responses
const handleResponse = async (response) => {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
  }
  return data;
};


// Email service functions
export const sendEmail = async (emailData, token = null) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/hub/send-email`, {
      method: 'POST',
      headers: getAuthHeaders(token),
      body: JSON.stringify(emailData)
    });
    return await handleResponse(response);
  } catch (error) {
    throw error;
  }
};

export async function getBackendHealth() {
  const r = await fetch(`${API_BASE_URL}/api/health`);
  return r.json();
}

export async function getMlHealth() {
  const r = await fetch(`${API_BASE_URL}/api/ml/health`);
  return r.json();
}

export async function matchText(query) {
  const r = await fetch(`${API_BASE_URL}/api/ml/match-text`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query })
  });
  return r.json();
}

export async function compareItems(lostItem, foundItem) {
  const r = await fetch(`${API_BASE_URL}/api/ml/compare-items`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ lost_item: lostItem, found_item: foundItem })
  });
  return r.json();
}

// Auth endpoints
export const signup = async (userData) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });
    return await handleResponse(response);
  } catch (error) {
    throw error;
  }
};

export const login = async (credentials) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });
    return await handleResponse(response);
  } catch (error) {
    throw error;
  }
};

// Get current user profile
export const getProfile = async (token = null) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/profile`, {
      headers: getAuthHeaders(token)
    });
    return await handleResponse(response);
  } catch (error) {
    throw error;
  }
};

// Update user profile
export const updateProfile = async (profileData, token = null) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/profile`, {
      method: 'PUT',
      headers: getAuthHeaders(token),
      body: JSON.stringify(profileData)
    });
    return await handleResponse(response);
  } catch (error) {
    throw error;
  }
};

// User endpoints
export const reportLostItem = async (itemData, token = null) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/user/report-lost`, {
      method: 'POST',
      headers: getAuthHeaders(token),
      body: JSON.stringify(itemData)
    });
    return await handleResponse(response);
  } catch (error) {
    throw error;
  }
};

export const reportFoundItem = async (itemData, token = null) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/user/report-found`, {
      method: 'POST',
      headers: getAuthHeaders(token),
      body: JSON.stringify(itemData)
    });
    return await handleResponse(response);
  } catch (error) {
    throw error;
  }
};

export const getUserReports = async (token = null) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/user/reports`, {
      headers: getAuthHeaders(token)
    });
    return await handleResponse(response);
  } catch (error) {
    throw error;
  }
};

export const searchItems = async (searchData, token = null) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/user/search`, {
      method: 'POST',
      headers: getAuthHeaders(token),
      body: JSON.stringify(searchData)
    });
    return await handleResponse(response);
  } catch (error) {
    throw error;
  }
};

export const claimItem = async (claimData, token = null) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/user/claim`, {
      method: 'POST',
      headers: getAuthHeaders(token),
      body: JSON.stringify(claimData)
    });
    return await handleResponse(response);
  } catch (error) {
    throw error;
  }
};

export const searchByImage = async (imageData, token = null) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/user/search-by-image`, {
      method: 'POST',
      headers: getAuthHeaders(token),
      body: JSON.stringify({ image: imageData })
    });
    return await handleResponse(response);
  } catch (error) {
    throw error;
  }
};

// Claims
export const getClaimHistory = async (token = null) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/user/claim-history`, {
      headers: getAuthHeaders(token)
    });
    return await handleResponse(response);
  } catch (error) {
    throw error;
  }
};

// Hub endpoints
export const getHubClaims = async (status = '', token = null) => {
  try {
    const queryParam = status ? `?status=${status}` : '';
    const response = await fetch(`${API_BASE_URL}/api/hub/claims${queryParam}`, {
      headers: getAuthHeaders(token)
    });
    return await handleResponse(response);
  } catch (error) {
    throw error;
  }
};

export const approveHubClaim = async (claimId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/hub/claim/${claimId}/approve`, {
      method: 'PUT',
      headers: getAuthHeaders()
    });
    return await handleResponse(response);
  } catch (error) {
    throw error;
  }
};
export const rejectHubClaim = async (claimId, message = '', token = null) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/hub/claim/${claimId}/reject`, {
      method: 'PUT',
      headers: getAuthHeaders(token),
      body: JSON.stringify({ message })
    });
    return await handleResponse(response);
  } catch (error) {
    throw error;
  }
};

export const partialVerificationClaim = async (claimId, message = '', token = null) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/hub/claim/${claimId}/partial`, {
      method: 'PUT',
      headers: getAuthHeaders(token),
      body: JSON.stringify({ message })
    });
    return await handleResponse(response);
  } catch (error) {
    throw error;
  }
};

export const getUserRewards = async (token = null) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/user/rewards`, {
      headers: getAuthHeaders(token)
    });
    return await handleResponse(response);
  } catch (error) {
    throw error;
  }
};

// Hub send claim message - Fixed with proper token handling
export const sendClaimMessage = async (claimId, { message, recipient }, token = null) => {
  try {
    // Use token from AuthContext if available, otherwise from localStorage
    const authToken = token || localStorage.getItem('token');
    
    if (!authToken) {
      throw new Error('Authentication token is missing');
    }
    
    console.log('Sending message with token:', 'Token present');
    
    // Refresh token from localStorage to ensure it's the latest
    const refreshedToken = localStorage.getItem('token');
    
    // First check if the response is JSON
    const response = await fetch(`${API_BASE_URL}/api/hub/claim/${claimId}/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${refreshedToken || authToken}`
      },
      body: JSON.stringify({ 
        subject: 'Claim Update', 
        message, 
        to: recipient,
        email: {
          service: EMAIL_SERVICE,
          user: EMAIL_USER,
          password: EMAIL_PASSWORD,
          enabled: true
        }
      }),
      credentials: 'include' // Include cookies if any
    });
    
    // Check if response is ok before trying to parse JSON
    if (!response.ok) {
      const errorText = await response.text();
      console.error('API Error Response:', errorText);
      
      // If token is invalid, try to refresh the page or notify user
      if (response.status === 403) {
        console.warn('Token may be expired. Consider refreshing the page.');
      }
      
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    // Try to parse as JSON
    try {
      const data = await response.json();
      return data;
    } catch (jsonError) {
      console.error('Failed to parse JSON response:', jsonError);
      throw new Error('Invalid response format from server');
    }
  } catch (error) {
    console.error('Error in sendClaimMessage:', error);
    throw error;
  }
};