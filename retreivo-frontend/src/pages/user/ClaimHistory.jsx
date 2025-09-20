import React, { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { FiClock, FiCheck, FiX, FiAlertTriangle, FiEye, FiMessageCircle, FiRefreshCw, FiCalendar, FiMapPin, FiTag } from 'react-icons/fi'

export default function ClaimHistory() {
  const { user } = useAuth();
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchClaimHistory();
    
    // Set up auto-refresh every 30 seconds to get real-time updates
    const interval = setInterval(fetchClaimHistory, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const fetchClaimHistory = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/user/claim-history`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      if (data.ok) {
        setClaims(data.claims);
        setError('');
      } else {
        setError(data.error || 'Failed to fetch claim history');
      }
    } catch (err) {
      setError('Failed to fetch claim history');
      console.error('Error fetching claim history:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'approved': return <FiCheck size={16} color="#10b981" />;
      case 'rejected': return <FiX size={16} color="#ef4444" />;
      case 'partial_verification': return <FiAlertTriangle size={16} color="#f59e0b" />;
      case 'pending': return <FiClock size={16} color="#3b82f6" />;
      default: return <FiClock size={16} color="#6b7280" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return '#10b981';
      case 'rejected': return '#ef4444';
      case 'partial_verification': return '#f59e0b';
      case 'pending': return '#3b82f6';
      default: return '#6b7280';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'approved': return 'Approved';
      case 'rejected': return 'Rejected';
      case 'partial_verification': return 'Meet in Person Required';
      case 'pending': return 'Pending Hub Review';
      default: return 'Unknown';
    }
  };

  if (loading) {
    return (
      <div className="container" style={{marginTop: '24px'}}>
        <div style={{textAlign: 'center', padding: '40px'}}>
          <div style={{fontSize: '18px', color: '#6b7280'}}>Loading your claim history...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{marginTop: '24px'}}>
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '32px'
      }}>
        <div>
          <h1 style={{
            fontSize: '32px',
            fontWeight: '700',
            color: '#111827',
            marginBottom: '8px'
          }}>
            Claim History
          </h1>
          <p style={{
            color: '#6b7280',
            fontSize: '16px'
          }}>
            Track the status of your item claims
          </p>
        </div>
        <button 
          onClick={() => fetchClaimHistory(true)}
          className="btn" 
          style={{
            background: '#3b82f6',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 16px'
          }}
          disabled={refreshing}
        >
          <FiRefreshCw size={16} style={{
            animation: refreshing ? 'spin 1s linear infinite' : 'none'
          }} />
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div style={{
          background: '#fef2f2',
          color: '#b91c1c',
          border: '1px solid #fecaca',
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '24px'
        }}>
          {error}
        </div>
      )}

      {/* Status Summary */}
      {claims.length > 0 && (
        <div className="card" style={{marginBottom: '24px'}}>
          <h3 style={{
            fontSize: '18px',
            fontWeight: '600',
            color: '#111827',
            marginBottom: '16px'
          }}>
            Claim Summary
          </h3>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '16px'
          }}>
            <div style={{
              textAlign: 'center',
              padding: '16px',
              background: '#f0f9ff',
              borderRadius: '8px',
              border: '1px solid #bae6fd'
            }}>
              <div style={{fontSize: '24px', fontWeight: '700', color: '#3b82f6'}}>
                {claims.filter(c => c.status === 'pending').length}
              </div>
              <div style={{fontSize: '14px', color: '#0c4a6e'}}>Pending</div>
            </div>
            <div style={{
              textAlign: 'center',
              padding: '16px',
              background: '#f0fdf4',
              borderRadius: '8px',
              border: '1px solid #bbf7d0'
            }}>
              <div style={{fontSize: '24px', fontWeight: '700', color: '#10b981'}}>
                {claims.filter(c => c.status === 'approved').length}
              </div>
              <div style={{fontSize: '14px', color: '#166534'}}>Approved</div>
            </div>
            <div style={{
              textAlign: 'center',
              padding: '16px',
              background: '#fef3c7',
              borderRadius: '8px',
              border: '1px solid #fde68a'
            }}>
              <div style={{fontSize: '24px', fontWeight: '700', color: '#f59e0b'}}>
                {claims.filter(c => c.status === 'partial_verification').length}
              </div>
              <div style={{fontSize: '14px', color: '#92400e'}}>Meet Required</div>
            </div>
            <div style={{
              textAlign: 'center',
              padding: '16px',
              background: '#fef2f2',
              borderRadius: '8px',
              border: '1px solid #fecaca'
            }}>
              <div style={{fontSize: '24px', fontWeight: '700', color: '#ef4444'}}>
                {claims.filter(c => c.status === 'rejected').length}
              </div>
              <div style={{fontSize: '14px', color: '#991b1b'}}>Rejected</div>
            </div>
          </div>
        </div>
      )}

      {/* Claims List */}
      {claims.length === 0 ? (
        <div className="card" style={{textAlign: 'center', padding: '40px'}}>
          <FiClock size={48} color="#9ca3af" style={{marginBottom: '16px'}} />
          <h3 style={{color: '#111827', marginBottom: '8px'}}>No claims yet</h3>
          <p style={{color: '#6b7280'}}>
            When you claim items, they will appear here with their status updates.
          </p>
        </div>
      ) : (
        <div className="card">
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '20px'
          }}>
            <h3 style={{
              fontSize: '20px',
              fontWeight: '600',
              color: '#111827'
            }}>
              Your Claims ({claims.length})
            </h3>
          </div>
          
          <div style={{
            display: 'grid',
            gap: '16px'
          }}>
            {claims.map(claim => (
              <div key={claim.claim_id} style={{
                border: '1px solid #e5e7eb',
                borderRadius: '12px',
                padding: '20px',
                background: 'white'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '16px'
                }}>
                  <div style={{flex: 1}}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      marginBottom: '8px'
                    }}>
                      <h4 style={{
                        fontSize: '18px',
                        fontWeight: '600',
                        color: '#111827',
                        margin: 0
                      }}>
                        {claim.item_name}
                      </h4>
                      <span style={{
                        fontSize: '12px',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        background: getStatusColor(claim.status) + '20',
                        color: getStatusColor(claim.status),
                        fontWeight: '500',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        {getStatusIcon(claim.status)}
                        {getStatusText(claim.status)}
                      </span>
                    </div>
                    
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: '16px',
                      fontSize: '14px',
                      color: '#6b7280',
                      marginBottom: '12px'
                    }}>
                      <div style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
                        <FiTag size={14} />
                        <strong>Type:</strong> {claim.item_type === 'found' ? 'Found Item' : 'Lost Item'}
                      </div>
                      <div style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
                        <FiCalendar size={14} />
                        <strong>Claimed:</strong> {new Date(claim.created_at).toLocaleDateString()}
                      </div>
                      <div style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
                        <FiCalendar size={14} />
                        <strong>Item Date:</strong> {claim.item_date ? new Date(claim.item_date).toLocaleDateString() : 'N/A'}
                      </div>
                      <div style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
                        <FiMapPin size={14} />
                        <strong>Location:</strong> {claim.item_location || 'Not specified'}
                      </div>
                    </div>
                    
                    {claim.item_description && (
                      <p style={{
                        fontSize: '14px',
                        color: '#6b7280',
                        margin: '0 0 12px 0',
                        lineHeight: '1.5'
                      }}>
                        <strong>Description:</strong> {claim.item_description}
                      </p>
                    )}
                    
                    {claim.hub_message && (
                      <div style={{
                        background: '#f0f9ff',
                        border: '1px solid #bae6fd',
                        borderRadius: '8px',
                        padding: '12px',
                        marginTop: '12px'
                      }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          marginBottom: '4px'
                        }}>
                          <FiMessageCircle size={14} color="#0ea5e9" />
                          <span style={{
                            fontSize: '12px',
                            fontWeight: '600',
                            color: '#0ea5e9'
                          }}>
                            Message from Hub:
                          </span>
                        </div>
                        <p style={{
                          fontSize: '14px',
                          color: '#0c4a6e',
                          margin: 0,
                          lineHeight: '1.4'
                        }}>
                          {claim.hub_message}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}