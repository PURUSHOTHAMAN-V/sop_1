import React, { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { FiSearch, FiFilter, FiEye, FiCheck, FiX, FiClock, FiAlertTriangle, FiUser, FiMapPin, FiCalendar, FiMail, FiDownload, FiPlus, FiMinus } from 'react-icons/fi'

export default function UserHistory() {
  const { user, token } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // all, lost, found, claims
  const [history, setHistory] = useState({
    lost_reports: [],
    found_reports: [],
    claims: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    fetchHistory();
  }, []);
  
  const fetchHistory = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:5000/api/user/history', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      if (data.ok) {
        setHistory(data);
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

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return '#10b981';
      case 'pending': return '#f59e0b';
      case 'rejected': return '#ef4444';
      case 'active': return '#3b82f6';
      case 'available': return '#10b981';
      case 'claimed': return '#6b7280';
      case 'found': return '#10b981';
      default: return '#6b7280';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'approved': return <FiCheck size={16} />;
      case 'pending': return <FiClock size={16} />;
      case 'rejected': return <FiX size={16} />;
      case 'active': return <FiMinus size={16} />;
      case 'available': return <FiPlus size={16} />;
      case 'claimed': return <FiCheck size={16} />;
      case 'found': return <FiCheck size={16} />;
      default: return <FiAlertTriangle size={16} />;
    }
  };

  const exportHistory = () => {
    const allItems = [
      ...history.lost_reports.map(item => ({...item, type: 'Lost Report'})),
      ...history.found_reports.map(item => ({...item, type: 'Found Report'})),
      ...history.claims.map(item => ({...item, type: 'Claim'}))
    ];

    const csvContent = [
      ['Type', 'Item Name', 'Status', 'Date', 'Location', 'Description'].join(','),
      ...allItems.map(item => [
        item.type,
        `"${item.name || 'N/A'}"`,
        item.status,
        new Date(item.created_at).toLocaleDateString(),
        `"${item.location || 'N/A'}"`,
        `"${item.description || 'N/A'}"`
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `user-history-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getFilteredItems = () => {
    let items = [];
    
    if (activeTab === 'all') {
      items = [
        ...history.lost_reports.map(item => ({...item, type: 'lost'})),
        ...history.found_reports.map(item => ({...item, type: 'found'})),
        ...history.claims.map(item => ({...item, type: 'claim'}))
      ];
    } else if (activeTab === 'lost') {
      items = history.lost_reports.map(item => ({...item, type: 'lost'}));
    } else if (activeTab === 'found') {
      items = history.found_reports.map(item => ({...item, type: 'found'}));
    } else if (activeTab === 'claims') {
      items = history.claims.map(item => ({...item, type: 'claim'}));
    }

    return items.filter(item => 
      item.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  if (loading) {
    return (
      <div className="container" style={{marginTop: '24px'}}>
        <div style={{textAlign: 'center', padding: '40px'}}>
          <div style={{fontSize: '18px', color: '#6b7280'}}>Loading your history...</div>
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

  const filteredItems = getFilteredItems();

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
            My History
          </h1>
          <p style={{
            color: '#6b7280',
            fontSize: '16px'
          }}>
            Your complete activity history on Retreivo
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
          background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
          color: 'white',
          textAlign: 'center'
        }}>
          <div style={{fontSize: '32px', fontWeight: '700', marginBottom: '8px'}}>
            {history.lost_reports.length}
          </div>
          <div style={{fontSize: '14px', opacity: 0.9}}>Lost Items Reported</div>
        </div>
        
        <div className="card" style={{
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          color: 'white',
          textAlign: 'center'
        }}>
          <div style={{fontSize: '32px', fontWeight: '700', marginBottom: '8px'}}>
            {history.found_reports.length}
          </div>
          <div style={{fontSize: '14px', opacity: 0.9}}>Found Items Reported</div>
        </div>
        
        <div className="card" style={{
          background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
          color: 'white',
          textAlign: 'center'
        }}>
          <div style={{fontSize: '32px', fontWeight: '700', marginBottom: '8px'}}>
            {history.claims.length}
          </div>
          <div style={{fontSize: '14px', opacity: 0.9}}>Claims Made</div>
        </div>
        
        <div className="card" style={{
          background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
          color: 'white',
          textAlign: 'center'
        }}>
          <div style={{fontSize: '32px', fontWeight: '700', marginBottom: '8px'}}>
            {history.claims.filter(c => c.status === 'approved').length}
          </div>
          <div style={{fontSize: '14px', opacity: 0.9}}>Approved Claims</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="card" style={{marginBottom: '24px'}}>
        <div style={{
          display: 'flex',
          background: '#f3f4f6',
          borderRadius: '8px',
          padding: '4px',
          marginBottom: '16px'
        }}>
          {[
            { key: 'all', label: 'All Activity' },
            { key: 'lost', label: 'Lost Reports' },
            { key: 'found', label: 'Found Reports' },
            { key: 'claims', label: 'Claims' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                background: activeTab === tab.key ? 'white' : 'transparent',
                color: activeTab === tab.key ? '#111827' : '#6b7280',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                boxShadow: activeTab === tab.key ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                flex: 1,
                textAlign: 'center'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

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
              placeholder="Search items..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{paddingLeft: '40px'}}
            />
          </div>
        </div>
      </div>

      {/* Items List */}
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
            {activeTab === 'all' ? 'All Activity' : 
             activeTab === 'lost' ? 'Lost Items' :
             activeTab === 'found' ? 'Found Items' : 'Claims'} ({filteredItems.length})
          </h3>
        </div>
        
        <div style={{
          display: 'grid',
          gap: '16px'
        }}>
          {filteredItems.map((item, index) => (
            <div key={`${item.type}-${item.item_id || item.claim_id}-${index}`} style={{
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
                      {item.name || 'Unknown Item'}
                    </h4>
                    <span style={{
                      fontSize: '12px',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      background: getStatusColor(item.status) + '20',
                      color: getStatusColor(item.status),
                      fontWeight: '500',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      {getStatusIcon(item.status)}
                      {item.status}
                    </span>
                    <span style={{
                      fontSize: '12px',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      background: item.type === 'lost' ? '#fef3c7' : 
                                 item.type === 'found' ? '#dbeafe' : '#f3e8ff',
                      color: item.type === 'lost' ? '#92400e' : 
                             item.type === 'found' ? '#1e40af' : '#7c3aed',
                      fontWeight: '500',
                      textTransform: 'uppercase'
                    }}>
                      {item.type}
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
                      <FiMapPin size={14} />
                      <span><strong>Location:</strong> {item.location || 'Unknown'}</span>
                    </div>
                    <div style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
                      <FiCalendar size={14} />
                      <span><strong>Date:</strong> {new Date(item.created_at).toLocaleDateString()}</span>
                    </div>
                    {item.type === 'claim' && (
                      <div style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
                        <span><strong>Claim ID:</strong> #{item.claim_id}</span>
                      </div>
                    )}
                    {item.type !== 'claim' && (
                      <div style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
                        <span><strong>Item ID:</strong> #{item.item_id}</span>
                      </div>
                    )}
                  </div>
                  
                  {item.description && (
                    <div style={{
                      marginTop: '12px',
                      padding: '12px',
                      background: '#f9fafb',
                      borderRadius: '8px',
                      fontSize: '14px',
                      color: '#6b7280'
                    }}>
                      <strong>Description:</strong> {item.description}
                    </div>
                  )}
                  
                  {item.hub_message && (
                    <div style={{
                      marginTop: '12px',
                      padding: '12px',
                      background: getStatusColor(item.status) + '10',
                      borderRadius: '8px',
                      fontSize: '14px',
                      color: getStatusColor(item.status),
                      border: `1px solid ${getStatusColor(item.status)}30`
                    }}>
                      <strong>Hub Message:</strong> {item.hub_message}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          {filteredItems.length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: '40px',
              color: '#6b7280'
            }}>
              <FiAlertTriangle size={48} style={{marginBottom: '16px', opacity: 0.5}} />
              <div style={{fontSize: '18px', marginBottom: '8px'}}>No items found</div>
              <div style={{fontSize: '14px'}}>Try adjusting your search or filter criteria</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

