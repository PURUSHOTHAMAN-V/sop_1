import React, { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { FiSearch, FiFilter, FiEye, FiCheck, FiX, FiClock, FiAlertTriangle, FiUser, FiMapPin, FiCalendar, FiMail } from 'react-icons/fi'
import { getHubClaims, approveHubClaim, sendClaimMessage } from '../../services/api'
import axios from 'axios'

export default function ClaimsManagement() {
  const { hub, token } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [fraudScoreRange, setFraudScoreRange] = useState([0, 100]);
  const [selectedClaim, setSelectedClaim] = useState(null);
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('card'); // 'card' or 'table'
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('');
  
  useEffect(() => {
    fetchClaims();
  }, []);
  
  useEffect(() => {
    if (showMessageModal && selectedClaim) {
      const prefill = (selectedClaim.claimerEmail || '').includes('@') ? selectedClaim.claimerEmail : '';
      setRecipientEmail(prefill);
    }
  }, [showMessageModal, selectedClaim]);
  
  const fetchClaims = async () => {
    try {
      setLoading(true);
      const response = await getHubClaims('', token);
      if (response.ok) {
        // Transform the API response to match our component's expected format
        const formattedClaims = response.claims.map(claim => ({
          id: claim.claim_id,
          item: claim.item_name,
          claimant: claim.claimer_name || 'Unknown User',
          claimantEmail: claim.claimer_email || 'No email provided',
          claimantPhone: claim.claimer_phone || 'No phone provided',
          dateClaimed: new Date(claim.created_at).toISOString().split('T')[0],
          dateLost: claim.date_lost || claim.date_found || 'Unknown',
          location: claim.item_location || 'Unknown',
          description: claim.item_description || 'No description',
          status: claim.status,
          priority: claim.item_type === 'found' ? 'high' : 'medium',
          fraudScore: claim.fraud_score || 0,
          itemType: claim.item_type,
          hubMessage: claim.hub_message,
          // Store the original claim data for reference
          originalClaim: claim
        }));
        setClaims(formattedClaims);
      } else {
        setError('Failed to fetch claims');
      }
    } catch (err) {
      console.error('Error fetching claims:', err);
      setError('Failed to fetch claims: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredClaims = (claims || []).filter(claim => {
    const matchesSearch = claim.item.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         claim.claimant.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || claim.status === statusFilter;
    const matchesFraudScore = claim.fraudScore >= fraudScoreRange[0] && claim.fraudScore <= fraudScoreRange[1];
    
    return matchesSearch && matchesStatus && matchesFraudScore;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return '#10b981';
      case 'pending': return '#f59e0b';
      case 'flagged': return '#ef4444';
      case 'resolved': return '#3b82f6';
      case 'rejected': return '#6b7280';
      default: return '#6b7280';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#10b981';
      default: return '#6b7280';
    }
  };

  const getFraudScoreColor = (score) => {
    if (score < 20) return '#10b981';
    if (score < 50) return '#f59e0b';
    return '#ef4444';
  };

  const handleApprove = async (claimId) => {
    try {
      const response = await approveHubClaim(claimId, token);
      if (response.ok) {
        // Update the local state to reflect the change
        setClaims(prevClaims => 
          prevClaims.map(claim => 
            claim.id === claimId ? { ...claim, status: 'approved' } : claim
          )
        );
        alert('Claim approved successfully!');
      } else {
        alert('Failed to approve claim: ' + response.error);
      }
    } catch (err) {
      console.error('Error approving claim:', err);
      alert('Failed to approve claim: ' + err.message);
    }
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedClaim) return;
    
    setSendingMessage(true);
    
    try {
      // First try to send via the claim message API
      const messageData = {
        message: messageText,
        recipient: recipientEmail || selectedClaim.claimantEmail
      };
      
      // Try to send email directly through the email API
      const emailData = {
        to: recipientEmail || selectedClaim.claimantEmail,
        subject: `Regarding your claim #${selectedClaim.id}`,
        body: messageText,
        claimId: selectedClaim.id
      };
      
      try {
        // Dedicated backend email API using axios
        const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        const emailResponse = await axios.post(`${baseUrl}/api/email/send-email`, {
          to: emailData.to,
          subject: emailData.subject,
          message: emailData.body
        });
        if (emailResponse.data?.ok) {
          // Email sent successfully via API
          setClaims(prevClaims => 
            prevClaims.map(claim => 
              claim.id === selectedClaim.id ? { 
                ...claim, 
                messages: [...(claim.messages || []), { 
                  sender: 'hub', 
                  text: messageText, 
                  timestamp: new Date().toISOString(),
                  emailSent: true
                }] 
              } : claim
            )
          );
          setShowMessageModal(false);
          setMessageText('');
          setRecipientEmail('');
          setSelectedClaim(null);
          alert('Email sent successfully!');
          setSendingMessage(false);
          return;
        }
      } catch (emailErr) {
        const serverMsg = emailErr?.response?.data?.error || emailErr?.message || 'Unknown error';
        console.log('Email API error:', serverMsg);
        alert(`Failed to send email: ${serverMsg}`);
        setSendingMessage(false);
        return;
      }
    } catch (err) {
      console.error('Error sending message:', err);
      
      // Show error message instead of opening external mail client
      alert('Failed to send email directly. Please try again later.');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleReject = async (claimId) => {
    try {
      const message = prompt('Enter rejection reason (optional):');
      // Use token from the component scope instead of calling useAuth()
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/hub/claim/${claimId}/reject`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message })
      });
      
      const data = await response.json();
      if (data.ok) {
        setClaims(prevClaims => 
          prevClaims.map(claim => 
            claim.id === claimId ? { ...claim, status: 'rejected', hubMessage: data.message } : claim
          )
        );
        alert('Claim rejected successfully!');
      } else {
        alert('Failed to reject claim: ' + data.error);
      }
    } catch (err) {
      console.error('Error rejecting claim:', err);
      alert('Failed to reject claim: ' + err.message);
    }
  };

  const handlePartialVerification = async (claimId) => {
    try {
      const message = prompt('Enter message for user (e.g., "Please visit the station with ID proof"):');
      if (!message) return;
      
      // Use token from the component scope instead of calling useAuth() inside the function
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/hub/claim/${claimId}/partial`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message })
      });
      
      const data = await response.json();
      if (data.ok) {
        setClaims(prevClaims => 
          prevClaims.map(claim => 
            claim.id === claimId ? { ...claim, status: 'partial_verification', hubMessage: data.message } : claim
          )
        );
        alert('Claim marked for partial verification!');
      } else {
        alert('Failed to update claim: ' + data.error);
      }
    } catch (err) {
      console.error('Error updating claim:', err);
      alert('Failed to update claim: ' + err.message);
    }
  };

  const handleViewDetails = (claim) => {
    setSelectedClaim(claim);
  };

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
            Claims Management
          </h1>
          <p style={{
            color: '#6b7280',
            fontSize: '16px'
          }}>
            Review and manage item claims for {hub?.name}
          </p>
        </div>
        <div style={{
          display: 'flex',
          gap: '12px'
        }}>
          <button className="btn" style={{
            background: '#111827',
            color: 'white'
          }}>
            Export Report
          </button>
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
            <option value="partial_verification">Partial Verification</option>
          </select>
        </div>
        
        {/* Fraud Score Filter */}
        <div style={{marginTop: '20px', padding: '20px', background: '#f9fafb', borderRadius: '12px', border: '1px solid #e5e7eb'}}>
          <div style={{marginBottom: '16px'}}>
            <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px'}}>
              <label style={{fontWeight: '600', color: '#111827', fontSize: '16px'}}>
                🛡️ Fraud Risk Filter
              </label>
              <div style={{
                fontSize: '14px',
                padding: '4px 8px',
                background: fraudScoreRange[0] === 0 && fraudScoreRange[1] === 100 ? '#e5e7eb' : '#3b82f6',
                color: fraudScoreRange[0] === 0 && fraudScoreRange[1] === 100 ? '#6b7280' : 'white',
                borderRadius: '6px',
                fontWeight: '500'
              }}>
                {fraudScoreRange[0] === 0 && fraudScoreRange[1] === 100 ? 'All Items' : `${fraudScoreRange[0]}-${fraudScoreRange[1]} Range`}
              </div>
            </div>
            
            <div style={{display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px'}}>
              <div style={{minWidth: '40px', textAlign: 'center', fontSize: '14px', fontWeight: '600', color: '#111827'}}>
                {fraudScoreRange[0]}
              </div>
              <div style={{flex: 1, position: 'relative'}}>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={fraudScoreRange[0]}
                  onChange={(e) => {
                    const newMin = parseInt(e.target.value);
                    if (newMin <= fraudScoreRange[1]) {
                      setFraudScoreRange([newMin, fraudScoreRange[1]]);
                    }
                  }}
                  style={{
                    width: '100%',
                    height: '6px',
                    background: 'linear-gradient(to right, #10b981 0%, #f59e0b 50%, #ef4444 100%)',
                    borderRadius: '3px',
                    outline: 'none',
                    appearance: 'none'
                  }}
                />
              </div>
              <div style={{minWidth: '40px', textAlign: 'center', fontSize: '14px', fontWeight: '600', color: '#111827'}}>
                {fraudScoreRange[1]}
              </div>
            </div>
            
            <div style={{display: 'flex', alignItems: 'center', gap: '16px'}}>
              <div style={{minWidth: '40px'}}></div>
              <div style={{flex: 1, position: 'relative'}}>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={fraudScoreRange[1]}
                  onChange={(e) => {
                    const newMax = parseInt(e.target.value);
                    if (newMax >= fraudScoreRange[0]) {
                      setFraudScoreRange([fraudScoreRange[0], newMax]);
                    }
                  }}
                  style={{
                    width: '100%',
                    height: '6px',
                    background: 'linear-gradient(to right, #10b981 0%, #f59e0b 50%, #ef4444 100%)',
                    borderRadius: '3px',
                    outline: 'none',
                    appearance: 'none'
                  }}
                />
              </div>
              <div style={{minWidth: '40px'}}></div>
            </div>
            
            <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#6b7280', marginTop: '8px'}}>
              <span style={{display: 'flex', alignItems: 'center', gap: '4px'}}>
                <div style={{width: '8px', height: '8px', background: '#10b981', borderRadius: '50%'}}></div>
                No Fraud (0)
              </span>
              <span style={{display: 'flex', alignItems: 'center', gap: '4px'}}>
                <div style={{width: '8px', height: '8px', background: '#f59e0b', borderRadius: '50%'}}></div>
                Moderate Risk (50)
              </span>
              <span style={{display: 'flex', alignItems: 'center', gap: '4px'}}>
                <div style={{width: '8px', height: '8px', background: '#ef4444', borderRadius: '50%'}}></div>
                High Risk (100)
              </span>
            </div>
            
            {/* Quick Filter Buttons */}
            <div style={{display: 'flex', gap: '8px', marginTop: '16px', flexWrap: 'wrap'}}>
              <button
                onClick={() => setFraudScoreRange([0, 100])}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  background: fraudScoreRange[0] === 0 && fraudScoreRange[1] === 100 ? '#3b82f6' : '#e5e7eb',
                  color: fraudScoreRange[0] === 0 && fraudScoreRange[1] === 100 ? 'white' : '#6b7280',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                All Items
              </button>
              <button
                onClick={() => setFraudScoreRange([0, 30])}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  background: fraudScoreRange[0] === 0 && fraudScoreRange[1] === 30 ? '#10b981' : '#e5e7eb',
                  color: fraudScoreRange[0] === 0 && fraudScoreRange[1] === 30 ? 'white' : '#6b7280',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                Low Risk (0-30)
              </button>
              <button
                onClick={() => setFraudScoreRange([30, 70])}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  background: fraudScoreRange[0] === 30 && fraudScoreRange[1] === 70 ? '#f59e0b' : '#e5e7eb',
                  color: fraudScoreRange[0] === 30 && fraudScoreRange[1] === 70 ? 'white' : '#6b7280',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                Medium Risk (30-70)
              </button>
              <button
                onClick={() => setFraudScoreRange([70, 100])}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  background: fraudScoreRange[0] === 70 && fraudScoreRange[1] === 100 ? '#ef4444' : '#e5e7eb',
                  color: fraudScoreRange[0] === 70 && fraudScoreRange[1] === 100 ? 'white' : '#6b7280',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                High Risk (70-100)
              </button>
            </div>
          </div>
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
            <div style={{display: 'flex', alignItems: 'center', gap: '16px'}}>
          <h3 style={{
            fontSize: '20px',
            fontWeight: '600',
                color: '#111827',
                margin: 0
          }}>
            Claims ({filteredClaims.length})
          </h3>
              
              {/* Fraud Score Statistics */}
              {filteredClaims.length > 0 && (
                <div style={{display: 'flex', gap: '12px', alignItems: 'center'}}>
                  <div style={{
                    fontSize: '12px',
                    padding: '4px 8px',
                    background: '#f0f9ff',
                    color: '#0369a1',
                    borderRadius: '6px',
                    fontWeight: '500'
                  }}>
                    Low Risk: {filteredClaims.filter(c => c.fraudScore < 30).length}
                  </div>
                  <div style={{
                    fontSize: '12px',
                    padding: '4px 8px',
                    background: '#fef3c7',
                    color: '#92400e',
                    borderRadius: '6px',
                    fontWeight: '500'
                  }}>
                    Medium Risk: {filteredClaims.filter(c => c.fraudScore >= 30 && c.fraudScore < 70).length}
                  </div>
                  <div style={{
                    fontSize: '12px',
                    padding: '4px 8px',
                    background: '#fef2f2',
                    color: '#991b1b',
                    borderRadius: '6px',
                    fontWeight: '500'
                  }}>
                    High Risk: {filteredClaims.filter(c => c.fraudScore >= 70).length}
                  </div>
                </div>
              )}
        </div>
        
          {/* View Toggle */}
          <div style={{
            display: 'flex',
            background: '#f3f4f6',
            borderRadius: '8px',
            padding: '4px'
          }}>
            <button
              onClick={() => setViewMode('card')}
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                border: 'none',
                background: viewMode === 'card' ? 'white' : 'transparent',
                color: viewMode === 'card' ? '#111827' : '#6b7280',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                boxShadow: viewMode === 'card' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              Card View
            </button>
            <button
              onClick={() => setViewMode('table')}
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                border: 'none',
                background: viewMode === 'table' ? 'white' : 'transparent',
                color: viewMode === 'table' ? '#111827' : '#6b7280',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                boxShadow: viewMode === 'table' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              Table View
            </button>
          </div>
        </div>
        
        {viewMode === 'card' ? (
        <div style={{
          display: 'grid',
          gap: '16px'
        }}>
          {filteredClaims.map(claim => (
            <div key={claim.id} style={{
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
                      {claim.item}
                    </h4>
                    <span style={{
                      fontSize: '12px',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      background: getStatusColor(claim.status) + '20',
                      color: getStatusColor(claim.status),
                      fontWeight: '500'
                    }}>
                      {claim.status}
                    </span>
                    <span style={{
                      fontSize: '12px',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      background: getPriorityColor(claim.priority) + '20',
                      color: getPriorityColor(claim.priority),
                      fontWeight: '500',
                      textTransform: 'uppercase'
                    }}>
                      {claim.priority}
                    </span>
                      {claim.fraudScore >= 70 && (
                        <span style={{
                          fontSize: '12px',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          background: '#fef2f2',
                          color: '#dc2626',
                          fontWeight: '600',
                          border: '1px solid #fecaca',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          <FiAlertTriangle size={12} />
                          HIGH RISK
                        </span>
                      )}
                    </div>
                  
                  {/* User Information Section */}
                  <div style={{
                    background: '#f0f9ff',
                    padding: '12px',
                    borderRadius: '8px',
                    marginBottom: '12px',
                    border: '1px solid #e0f2fe'
                  }}>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#0369a1',
                      marginBottom: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <FiUser size={16} />
                      Claimant Details
                    </div>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                      gap: '8px',
                      fontSize: '13px',
                      color: '#0c4a6e'
                    }}>
                      <div><strong>Name:</strong> {claim.claimant}</div>
                      <div><strong>Email:</strong> {claim.claimantEmail}</div>
                      <div><strong>Phone:</strong> {claim.claimantPhone}</div>
                    </div>
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
                      <span>{claim.claimant}</span>
                    </div>
                    <div style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
                      <span>📧 {claim.claimantEmail}</span>
                    </div>
                    <div style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
                      <span>📞 {claim.claimantPhone}</span>
                    </div>
                    <div style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
                      <FiMapPin size={14} />
                      <span>{claim.location}</span>
                    </div>
                    <div style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
                      <FiCalendar size={14} />
                      <span>Claimed: {claim.dateClaimed}</span>
                    </div>
                    <div style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
                      <FiAlertTriangle size={14} />
                      <span style={{
                        color: getFraudScoreColor(claim.fraudScore),
                        fontWeight: '600',
                        fontSize: '14px'
                      }}>
                        Fraud Score: {claim.fraudScore}% ({claim.riskLevel || 'Medium'})
                      </span>
                      <div style={{
                        width: '60px',
                        height: '4px',
                        background: '#e5e7eb',
                        borderRadius: '2px',
                        overflow: 'hidden',
                        marginLeft: '8px'
                      }}>
                        <div style={{
                          width: `${claim.fraudScore}%`,
                          height: '100%',
                          background: getFraudScoreColor(claim.fraudScore),
                          transition: 'width 0.3s ease'
                        }}></div>
                    </div>
                    </div>
                    
                    {/* Fraud Indicators */}
                    {claim.fraudIndicators && claim.fraudIndicators.length > 0 && (
                      <div style={{
                        marginTop: '8px',
                        padding: '8px 12px',
                        background: claim.fraudScore >= 70 ? '#fef2f2' : claim.fraudScore >= 30 ? '#fef3c7' : '#f0f9ff',
                        border: `1px solid ${claim.fraudScore >= 70 ? '#fecaca' : claim.fraudScore >= 30 ? '#fde68a' : '#bae6fd'}`,
                        borderRadius: '6px',
                        fontSize: '12px'
                      }}>
                        <div style={{
                          fontWeight: '600',
                          color: claim.fraudScore >= 70 ? '#dc2626' : claim.fraudScore >= 30 ? '#d97706' : '#0369a1',
                          marginBottom: '4px'
                        }}>
                          Risk Indicators:
                        </div>
                        <ul style={{margin: 0, paddingLeft: '16px'}}>
                          {claim.fraudIndicators.slice(0, 3).map((indicator, idx) => (
                            <li key={idx} style={{marginBottom: '2px'}}>
                              {indicator}
                            </li>
                          ))}
                          {claim.fraudIndicators.length > 3 && (
                            <li style={{fontStyle: 'italic'}}>
                              +{claim.fraudIndicators.length - 3} more indicators
                            </li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
                
                <div style={{
                  display: 'flex',
                  gap: '8px'
                }}>
                  <button 
                    onClick={() => handleViewDetails(claim)}
                    className="btn" 
                    style={{
                      background: '#3b82f6',
                      color: 'white',
                      padding: '8px 12px',
                      fontSize: '14px'
                    }}
                  >
                    <FiEye size={16} />
                  </button>
                  
                  {claim.status === 'pending' && (
                    <>
                      <button 
                        onClick={() => {
                          setSelectedClaim(claim);
                          setShowMessageModal(true);
                        }}
                        className="btn" 
                        style={{
                          background: '#3b82f6',
                          color: 'white',
                          padding: '8px 12px',
                          fontSize: '14px'
                        }}
                        title="Send Message to Claimant"
                      >
                        <FiUser size={16} />
                      </button>
                      <button 
                        onClick={() => handleApprove(claim.id)}
                        className="btn" 
                        style={{
                          background: '#10b981',
                          color: 'white',
                          padding: '8px 12px',
                          fontSize: '14px'
                        }}
                        title="Approve Claim"
                      >
                        <FiCheck size={16} />
                      </button>
                      <button 
                        onClick={() => handleReject(claim.id)}
                        className="btn" 
                        style={{
                          background: '#ef4444',
                          color: 'white',
                          padding: '8px 12px',
                          fontSize: '14px'
                        }}
                        title="Reject Claim"
                      >
                        <FiX size={16} />
                      </button>
                      <button 
                        onClick={() => handlePartialVerification(claim.id)}
                        className="btn" 
                        style={{
                          background: '#f59e0b',
                          color: 'white',
                          padding: '8px 12px',
                          fontSize: '14px'
                        }}
                        title="Require In-Person Verification"
                      >
                        <FiAlertTriangle size={16} />
                      </button>
                    </>
                  )}
                </div>
              </div>
              
              <p style={{
                fontSize: '14px',
                color: '#6b7280',
                margin: 0,
                lineHeight: '1.5'
              }}>
                {claim.description}
              </p>
            </div>
          ))}
        </div>
        ) : (
          /* Table View */
          <div style={{
            overflow: 'auto',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            background: 'white'
          }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '14px'
            }}>
              <thead>
                <tr style={{
                  background: '#f9fafb',
                  borderBottom: '2px solid #e5e7eb'
                }}>
                  <th style={{padding: '12px', textAlign: 'left', fontWeight: '600', color: '#111827'}}>Item Name</th>
                  <th style={{padding: '12px', textAlign: 'left', fontWeight: '600', color: '#111827'}}>Category</th>
                  <th style={{padding: '12px', textAlign: 'left', fontWeight: '600', color: '#111827'}}>Description</th>
                  <th style={{padding: '12px', textAlign: 'left', fontWeight: '600', color: '#111827'}}>Date</th>
                  <th style={{padding: '12px', textAlign: 'left', fontWeight: '600', color: '#111827'}}>User Name</th>
                  <th style={{padding: '12px', textAlign: 'left', fontWeight: '600', color: '#111827'}}>Email</th>
                  <th style={{padding: '12px', textAlign: 'left', fontWeight: '600', color: '#111827'}}>Phone</th>
                  <th style={{padding: '12px', textAlign: 'left', fontWeight: '600', color: '#111827'}}>Status</th>
                  <th style={{padding: '12px', textAlign: 'left', fontWeight: '600', color: '#111827'}}>Fraud Score</th>
                  <th style={{padding: '12px', textAlign: 'center', fontWeight: '600', color: '#111827'}}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredClaims.map(claim => (
                  <tr key={claim.id} style={{
                    borderBottom: '1px solid #e5e7eb',
                    '&:hover': { background: '#f9fafb' }
                  }}>
                    <td style={{padding: '12px', fontWeight: '500', color: '#111827'}}>{claim.item}</td>
                    <td style={{padding: '12px', color: '#6b7280'}}>{claim.itemType}</td>
                    <td style={{padding: '12px', color: '#6b7280', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                      {claim.description}
                    </td>
                    <td style={{padding: '12px', color: '#6b7280'}}>{claim.dateClaimed}</td>
                    <td style={{padding: '12px', fontWeight: '500', color: '#111827'}}>{claim.claimant}</td>
                    <td style={{padding: '12px', color: '#6b7280'}}>{claim.claimantEmail}</td>
                    <td style={{padding: '12px', color: '#6b7280'}}>{claim.claimantPhone}</td>
                    <td style={{padding: '12px'}}>
                      <span style={{
                        fontSize: '12px',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        background: getStatusColor(claim.status) + '20',
                        color: getStatusColor(claim.status),
                        fontWeight: '500'
                      }}>
                        {claim.status}
                      </span>
                    </td>
                    <td style={{padding: '12px'}}>
                      <span style={{
                        color: getFraudScoreColor(claim.fraudScore),
                        fontWeight: '600'
                      }}>
                        {claim.fraudScore}%
                      </span>
                    </td>
                    <td style={{padding: '12px', textAlign: 'center'}}>
                      <div style={{display: 'flex', gap: '4px', justifyContent: 'center'}}>
                        <button 
                          onClick={() => handleViewDetails(claim)}
                          style={{
                            background: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '6px 8px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                          title="View Details"
                        >
                          <FiEye size={14} />
                        </button>
                        
                        {claim.status === 'pending' && (
                          <>
                            <button 
                              onClick={() => handleApprove(claim.id)}
                              style={{
                                background: '#10b981',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                padding: '6px 8px',
                                cursor: 'pointer',
                                fontSize: '12px'
                              }}
                              title="Approve"
                            >
                              <FiCheck size={14} />
                            </button>
                            <button 
                              onClick={() => handleReject(claim.id)}
                              style={{
                                background: '#ef4444',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                padding: '6px 8px',
                                cursor: 'pointer',
                                fontSize: '12px'
                              }}
                              title="Reject"
                            >
                              <FiX size={14} />
                            </button>
                            <button 
                              onClick={() => handlePartialVerification(claim.id)}
                              style={{
                                background: '#f59e0b',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                padding: '6px 8px',
                                cursor: 'pointer',
                                fontSize: '12px'
                              }}
                              title="Partial Verification"
                            >
                              <FiAlertTriangle size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Claim Details Modal */}
      {selectedClaim && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '24px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '600px',
            width: '100%',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '24px'
            }}>
              <h2 style={{
                fontSize: '24px',
                fontWeight: '700',
                color: '#111827',
                margin: 0
              }}>
                Claim Details
              </h2>
              <button 
                onClick={() => setSelectedClaim(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#6b7280'
                }}
              >
                ×
              </button>
            </div>
            
            <div style={{
              display: 'grid',
              gap: '20px'
            }}>
              <div>
                <h3 style={{
                  fontSize: '18px',
                  fontWeight: '600',
                  color: '#111827',
                  marginBottom: '12px'
                }}>
                  Item Information
                </h3>
                <div style={{
                  background: '#f9fafb',
                  padding: '16px',
                  borderRadius: '8px'
                }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '12px',
                    fontSize: '14px'
                  }}>
                    <div><strong>Item:</strong> {selectedClaim.item}</div>
                    <div><strong>Status:</strong> 
                      <span style={{
                        color: getStatusColor(selectedClaim.status),
                        fontWeight: '500',
                        marginLeft: '8px'
                      }}>
                        {selectedClaim.status}
                      </span>
                    </div>
                    <div><strong>Priority:</strong> 
                      <span style={{
                        color: getPriorityColor(selectedClaim.priority),
                        fontWeight: '500',
                        marginLeft: '8px'
                      }}>
                        {selectedClaim.priority}
                      </span>
                    </div>
                    <div><strong>Fraud Score:</strong> 
                      <span style={{
                        color: getFraudScoreColor(selectedClaim.fraudScore),
                        fontWeight: '500',
                        marginLeft: '8px'
                      }}>
                        {selectedClaim.fraudScore}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 style={{
                  fontSize: '18px',
                  fontWeight: '600',
                  color: '#111827',
                  marginBottom: '12px'
                }}>
                  Claimant Information
                </h3>
                <div style={{
                  background: '#f9fafb',
                  padding: '16px',
                  borderRadius: '8px'
                }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '12px',
                    fontSize: '14px'
                  }}>
                    <div><strong>Name:</strong> {selectedClaim.claimant}</div>
                    <div><strong>Email:</strong> {selectedClaim.claimantEmail}</div>
                    <div><strong>Phone:</strong> {selectedClaim.claimantPhone}</div>
                    <div><strong>Date Lost:</strong> {selectedClaim.dateLost}</div>
                    <div><strong>Date Claimed:</strong> {selectedClaim.dateClaimed}</div>
                    <div><strong>Location:</strong> {selectedClaim.location}</div>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 style={{
                  fontSize: '18px',
                  fontWeight: '600',
                  color: '#111827',
                  marginBottom: '12px'
                }}>
                  Description
                </h3>
                <p style={{
                  fontSize: '14px',
                  color: '#6b7280',
                  lineHeight: '1.6',
                  margin: 0
                }}>
                  {selectedClaim.description}
                </p>
              </div>
              
              <div>
                <h3 style={{
                  fontSize: '18px',
                  fontWeight: '600',
                  color: '#111827',
                  marginBottom: '12px'
                }}>
                  Documents & Images
                </h3>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                  gap: '12px'
                }}>
                  {(selectedClaim.documents || []).map((doc, index) => (
                    <div key={index} style={{
                      padding: '12px',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      textAlign: 'center',
                      fontSize: '14px',
                      color: '#3b82f6',
                      cursor: 'pointer'
                    }}>
                      📄 {doc}
                    </div>
                  ))}
                  {(selectedClaim.images || []).map((img, index) => (
                    <div key={index} style={{
                      padding: '12px',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      textAlign: 'center',
                      fontSize: '14px',
                      color: '#3b82f6',
                      cursor: 'pointer'
                    }}>
                      📷 {img}
                    </div>
                  ))}
                </div>
              </div>
              
              {selectedClaim.status === 'pending' && (
                <div style={{
                  display: 'flex',
                  gap: '12px',
                  justifyContent: 'flex-end'
                }}>
                  <button 
                    onClick={() => handleReject(selectedClaim.id)}
                    className="btn" 
                    style={{
                      background: '#ef4444',
                      color: 'white'
                    }}
                  >
                    Reject Claim
                  </button>
                  <button 
                    onClick={() => handleApprove(selectedClaim.id)}
                    className="btn" 
                    style={{
                      background: '#10b981',
                      color: 'white'
                    }}
                  >
                    Approve Claim
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Message Modal */}
      {showMessageModal && selectedClaim && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            width: '90%',
            maxWidth: '500px',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <h3 style={{
              fontSize: '20px',
              fontWeight: '600',
              color: '#111827',
              marginBottom: '16px'
            }}>
              Send Email to Claimant
            </h3>
            
            <div style={{
              marginBottom: '16px',
              padding: '12px',
              background: '#f9fafb',
              borderRadius: '8px',
              border: '1px solid #e5e7eb'
            }}>
              <div style={{fontSize: '14px', color: '#6b7280', marginBottom: '4px'}}>
                <strong>Claimant:</strong> {selectedClaim.claimant}
              </div>
              <div style={{fontSize: '14px', color: '#6b7280', marginBottom: '4px'}}>
                <strong>Claimant Email:</strong> {selectedClaim.claimantEmail}
              </div>
              <div style={{fontSize: '14px', color: '#6b7280', marginBottom: '4px'}}>
                <strong>Item:</strong> {selectedClaim.item}
              </div>
            </div>

            {/* Recipient override */}
            <div style={{marginBottom: '16px'}}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontWeight: '500',
                color: '#111827'
              }}>
                Recipient email
              </label>
              <input
                className="input"
                placeholder="Enter recipient email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                style={{width: '100%'}}
              />
              {!recipientEmail && (
                <div style={{marginTop: '6px', fontSize: '12px', color: '#ef4444'}}>
                  No email on file. Please enter an email to send.
                </div>
              )}
            </div>
            
            <div style={{marginBottom: '20px'}}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontWeight: '500',
                color: '#111827'
              }}>
                Message
              </label>
              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Enter your message to the claimant..."
                style={{
                  width: '100%',
                  minHeight: '120px',
                  padding: '12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  resize: 'vertical'
                }}
              />
            </div>
            
            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={() => {
                  setShowMessageModal(false);
                  setMessageText('');
                  setRecipientEmail('');
                  setSelectedClaim(null);
                }}
                className="btn"
                style={{
                  background: '#6b7280',
                  color: 'white',
                  padding: '10px 20px'
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSendMessage}
                disabled={sendingMessage || !messageText.trim()}
                className="btn"
                style={{
                  background: sendingMessage ? '#9ca3af' : '#3b82f6',
                  color: 'white',
                  padding: '10px 20px'
                }}
              >
                {sendingMessage ? 'Sending...' : 'Send Email'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}






