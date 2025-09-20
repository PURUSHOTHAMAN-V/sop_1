import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import Sidebar from '../../components/common/Sidebar'
import { getClaimHistory } from '../../services/api'
import { FiClock, FiCheck, FiX, FiAlertTriangle, FiArrowRight } from 'react-icons/fi'

export default function UserDashboard() {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchClaimHistory();
  }, []);

  const fetchClaimHistory = async () => {
    try {
      setLoading(true);
      const data = await getClaimHistory();
      if (data.ok) {
        setClaims(data.claims);
      } else {
        setError(data.error || 'Failed to fetch claim history');
      }
    } catch (err) {
      setError('Failed to fetch claim history');
      console.error('Error fetching claim history:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending': return <FiClock className="status-icon pending" />;
      case 'approved': return <FiCheck className="status-icon approved" />;
      case 'rejected': return <FiX className="status-icon rejected" />;
      case 'partial': return <FiAlertTriangle className="status-icon partial" />;
      default: return <FiClock className="status-icon" />;
    }
  };

  return (
    <div className="layout">
      <Sidebar />
      <main className="content">
        <h2>Welcome back</h2>
        <div className="grid grid-2">
          <div className="card"><strong>Reports</strong><p>Your recent lost/found reports.</p></div>
          <div className="card"><strong>Rewards</strong><p>Balance and recent activity.</p></div>
        </div>
        
        <div className="section">
          <div className="section-header">
            <h3>Recent Claims</h3>
            <Link to="/user/claim-history" className="view-all">
              View all <FiArrowRight />
            </Link>
          </div>
          
          {loading ? (
            <div className="loading">Loading claims...</div>
          ) : error ? (
            <div className="error">{error}</div>
          ) : claims.length === 0 ? (
            <div className="empty-state">
              <p>You haven't made any claims yet.</p>
              <Link to="/search" className="btn btn-primary">Search for items</Link>
            </div>
          ) : (
            <div className="claims-list">
              {claims.slice(0, 3).map(claim => (
                <div key={claim.claim_id} className="claim-card">
                  <div className="claim-status">
                    {getStatusIcon(claim.status)}
                    <span className={`status-text ${claim.status}`}>
                      {claim.status.charAt(0).toUpperCase() + claim.status.slice(1)}
                    </span>
                  </div>
                  <div className="claim-details">
                    <h4>{claim.item_name}</h4>
                    <p className="claim-date">Claimed on {new Date(claim.created_at).toLocaleDateString()}</p>
                  </div>
                  <Link to={`/user/claim-history`} className="btn btn-sm">
                    Details
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}






