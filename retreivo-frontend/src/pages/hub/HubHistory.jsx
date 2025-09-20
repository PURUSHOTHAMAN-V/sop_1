import React, { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { FiSearch, FiFilter, FiEye, FiCheck, FiX, FiClock, FiAlertTriangle, FiUser, FiMapPin, FiCalendar, FiMail, FiDownload } from 'react-icons/fi'

export default function HubHistory() {
  const { hub, token } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [claims, setClaims] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    fetchHistory();
  }, [statusFilter]);
  
  const fetchHistory = async () => {
    try {
      setLoading(true);
      const url = statusFilter === 'all' 
        ? 'http://localhost:5000/api/hub/history'
        : `http://localhost:5000/api/hub/history?status=${statusFilter}`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      if (data.ok) {
        setClaims(data.claims);
        setCounts(data.counts || {});
      } else {
        setError('Failed to fetch history');
      }
    } catch (err) {
      console.error('Error fetching history:', err);
      setError('Failed to fetch history: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredClaims = claims.filter(claim => {
    const matchesSearch = claim.item_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         claim.claimer_name?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return '#10b981';
      case 'pending': return '#f59e0b';
      case 'rejected': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'approved': return <FiCheck size={16} />;
      case 'pending': return <FiClock size={16} />;
      case 'rejected': return <FiX size={16} />;
      default: return <FiAlertTriangle size={16} />;
    }
  };

  const exportHistory = () => {
    const csvContent = [
      ['Claim ID', 'Item Name', 'Claimant', 'Status', 'Date', 'Item Type', 'Location'].join(','),
      ...filteredClaims.map(claim => [
        claim.claim_id,
        `"${claim.item_name || 'N/A'}"`,
        `"${claim.claimer_name || 'N/A'}"`,
        claim.status,
        new Date(claim.created_at).toLocaleDateString(),
        claim.item_type,
        `"${claim.item_location || 'N/A'}"`
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hub-history-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="container" style={{marginTop: '24px'}}>
        <div style={{textAlign: 'center', padding: '40px'}}>
          <div style={{fontSize: '18px', color: '#6b7280'}}>Loading history...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container" style={{marginTop: '24px'}}>
        <div style={{textAlign: 'center', padding: '40px'}}>
          <div style={{fontSize: '18px', color: '#ef4444'}}>{error}</div>
          <button onClick={fetchHistory} className="btn" style={{marginTop: '16px'}}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{marginTop: '24px'}}>
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
            Hub History
          </h1>
          <p style={{
            color: '#6b7280',
            fontSize: '16px'
          }}>
            Complete history of all claims processed by {hub?.name}
          </p>
        </div>
        <div style={{
          display: 'flex',
          gap: '12px'
        }}>
          <button 
            onClick={exportHistory}
            className="btn" 
            style={{
              background: '#10b981',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <FiDownload size={16} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <div className="card" style={{
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          color: 'white',
          textAlign: 'center'
        }}>
          <div style={{fontSize: '32px', fontWeight: '700', marginBottom: '8px'}}>
            {counts.approved || 0}
          </div>
          <div style={{fontSize: '14px', opacity: 0.9}}>Approved Claims</div>
        </div>
        
        <div className="card" style={{
          background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
          color: 'white',
          textAlign: 'center'
        }}>
          <div style={{fontSize: '32px', fontWeight: '700', marginBottom: '8px'}}>
            {counts.pending || 0}
          </div>
          <div style={{fontSize: '14px', opacity: 0.9}}>Pending Claims</div>
        </div>
        
        <div className="card" style={{
          background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
          color: 'white',
          textAlign: 'center'
        }}>
          <div style={{fontSize: '32px', fontWeight: '700', marginBottom: '8px'}}>
            {counts.rejected || 0}
          </div>
          <div style={{fontSize: '14px', opacity: 0.9}}>Rejected Claims</div>
        </div>
        
        <div className="card" style={{
          background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
          color: 'white',
          textAlign: 'center'
        }}>
          <div style={{fontSize: '32px', fontWeight: '700', marginBottom: '8px'}}>
            {Object.values(counts).reduce((a, b) => a + b, 0)}
          </div>
          <div style={{fontSize: '14px', opacity: 0.9}}>Total Claims</div>
        </div>
      </div>

      {/* Filters */}
      <div className="card" style={{marginBottom: '24px'}}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px'
        }}>
          <div style={{position: 'relative'}}>
            <FiSearch style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#9ca3af'
            }} />
            <input 
              className="input" 
              placeholder="Search claims..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{paddingLeft: '40px'}}
            />
          </div>
          
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* Claims List */}
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
            color: '#111827',
            margin: 0
          }}>
            Claims History ({filteredClaims.length})
          </h3>
        </div>
        
        <div style={{
          display: 'grid',
          gap: '16px'
        }}>
          {filteredClaims.map(claim => (
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
                      {claim.item_name || 'Unknown Item'}
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
                      {claim.status}
                    </span>
                    <span style={{
                      fontSize: '12px',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      background: claim.item_type === 'found' ? '#dbeafe' : '#fef3c7',
                      color: claim.item_type === 'found' ? '#1e40af' : '#92400e',
                      fontWeight: '500',
                      textTransform: 'uppercase'
                    }}>
                      {claim.item_type}
                    </span>
                  </div>
                  
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '16px',
                    fontSize: '14px',
                    color: '#6b7280'
                  }}>
                    <div style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
                      <FiUser size={14} />
                      <span><strong>Claimant:</strong> {claim.claimer_name || 'Unknown'}</span>
                    </div>
                    <div style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
                      <span>📧 <strong>Email:</strong> {claim.claimer_email || 'N/A'}</span>
                    </div>
                    <div style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
                      <span>📞 <strong>Phone:</strong> {claim.claimer_phone || 'N/A'}</span>
                    </div>
                    <div style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
                      <FiMapPin size={14} />
                      <span><strong>Location:</strong> {claim.item_location || 'Unknown'}</span>
                    </div>
                    <div style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
                      <FiCalendar size={14} />
                      <span><strong>Claimed:</strong> {new Date(claim.created_at).toLocaleDateString()}</span>
                    </div>
                    <div style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
                      <span><strong>Claim ID:</strong> #{claim.claim_id}</span>
                    </div>
                  </div>
                  
                  {claim.item_description && (
                    <div style={{
                      marginTop: '12px',
                      padding: '12px',
                      background: '#f9fafb',
                      borderRadius: '8px',
                      fontSize: '14px',
                      color: '#6b7280'
                    }}>
                      <strong>Description:</strong> {claim.item_description}
                    </div>
                  )}
                  
                  {claim.hub_message && (
                    <div style={{
                      marginTop: '12px',
                      padding: '12px',
                      background: getStatusColor(claim.status) + '10',
                      borderRadius: '8px',
                      fontSize: '14px',
                      color: getStatusColor(claim.status),
                      border: `1px solid ${getStatusColor(claim.status)}30`
                    }}>
                      <strong>Hub Message:</strong> {claim.hub_message}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          {filteredClaims.length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: '40px',
              color: '#6b7280'
            }}>
              <FiAlertTriangle size={48} style={{marginBottom: '16px', opacity: 0.5}} />
              <div style={{fontSize: '18px', marginBottom: '8px'}}>No claims found</div>
              <div style={{fontSize: '14px'}}>Try adjusting your search or filter criteria</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

