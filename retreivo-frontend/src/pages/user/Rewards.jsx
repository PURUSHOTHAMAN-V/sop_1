import React, { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { FiGift, FiTrendingUp, FiClock, FiDownload, FiStar, FiAward } from 'react-icons/fi'
import { FaCoins } from 'react-icons/fa'

export default function Rewards() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [walletData, setWalletData] = useState({
    balance: 0,
    totalEarned: 0,
    totalSpent: 0,
    level: 'Bronze',
    nextLevel: 'Silver',
    pointsToNext: 100
  });
  const [rewards, setRewards] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRewardsData();
  }, []);

  const fetchRewardsData = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:5000/api/user/rewards', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      if (data.ok) {
        const balance = data.balance || 0;
        const totalEarned = data.history.reduce((sum, reward) => sum + (reward.amount || 0), 0);
        const totalSpent = 0; // No spending functionality yet
        
        // Calculate level based on total earned
        let level = 'Bronze';
        let nextLevel = 'Silver';
        let pointsToNext = 100;
        
        if (totalEarned >= 1000) {
          level = 'Gold';
          nextLevel = 'Platinum';
          pointsToNext = 1000;
        } else if (totalEarned >= 500) {
          level = 'Silver';
          nextLevel = 'Gold';
          pointsToNext = 500;
        }
        
        setWalletData({
          balance,
          totalEarned,
          totalSpent,
          level,
          nextLevel,
          pointsToNext
        });
        
        setRewards(data.history || []);
      }
    } catch (err) {
      console.error('Error fetching rewards:', err);
    } finally {
      setLoading(false);
    }
  };

  // Convert rewards history to transaction format
  const transactions = rewards.map(reward => ({
    id: reward.reward_id,
    type: 'earned',
    amount: reward.amount,
    description: reward.reason || 'Reward earned',
    date: new Date(reward.created_at).toISOString().split('T')[0],
    status: 'completed',
    itemType: reward.item_type,
    itemId: reward.item_id,
    timestamp: reward.created_at
  }));

  // Calculate community contribution stats
  const communityStats = {
    itemsFound: rewards.filter(r => r.item_type === 'found').length,
    itemsLost: rewards.filter(r => r.item_type === 'lost').length,
    totalHelped: rewards.filter(r => r.item_type === 'found').length,
    totalReported: rewards.filter(r => r.item_type === 'lost').length
  };

  // Mock rewards catalog (could be fetched from API in future)
  const rewardsCatalog = [
    {
      id: 1,
      name: 'Amazon Gift Card',
      description: '₹500 Amazon gift card',
      points: 500,
      image: '/assets/logo.png',
      category: 'Shopping',
      available: true
    },
    {
      id: 2,
      name: 'Starbucks Voucher',
      description: '₹200 Starbucks voucher',
      points: 200,
      image: '/assets/logo.png',
      category: 'Food',
      available: true
    },
    {
      id: 3,
      name: 'Movie Tickets',
      description: '2 PVR movie tickets',
      points: 400,
      image: '/assets/logo.png',
      category: 'Entertainment',
      available: true
    },
    {
      id: 4,
      name: 'Uber Credits',
      description: '₹300 Uber ride credits',
      points: 300,
      image: '/assets/logo.png',
      category: 'Transport',
      available: true
    },
    {
      id: 5,
      name: 'Zomato Credits',
      description: '₹250 Zomato food credits',
      points: 250,
      image: '/assets/logo.png',
      category: 'Food',
      available: false
    }
  ];

  const achievements = [
    {
      id: 1,
      name: 'First Find',
      description: 'Report your first found item',
      icon: FiStar,
      earned: true,
      date: '2024-01-10'
    },
    {
      id: 2,
      name: 'Helping Hand',
      description: 'Report 5 found items',
      icon: FiAward,
      earned: true,
      date: '2024-01-15'
    },
    {
      id: 3,
      name: 'Community Hero',
      description: 'Report 10 found items',
      icon: FiGift,
      earned: false,
      progress: 7
    },
    {
      id: 4,
      name: 'Gold Member',
      description: 'Earn 1000 points',
      icon: FaCoins,
      earned: true,
      date: '2024-01-12'
    }
  ];

  const handleRedeem = (reward) => {
    console.log('Redeeming reward:', reward);
    // In real app, this would call API to redeem reward
  };

  const getLevelColor = (level) => {
    switch (level) {
      case 'Bronze': return '#cd7f32';
      case 'Silver': return '#c0c0c0';
      case 'Gold': return '#ffd700';
      case 'Platinum': return '#e5e4e2';
      default: return '#6b7280';
    }
  };

  if (loading) {
    return (
      <div className="container" style={{marginTop: '24px'}}>
        <div style={{textAlign: 'center', padding: '40px'}}>
          <div style={{fontSize: '18px', color: '#6b7280'}}>Loading your rewards...</div>
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
            Rewards & Wallet
          </h1>
          <p style={{
            color: '#6b7280',
            fontSize: '16px'
          }}>
            Earn points and redeem exciting rewards
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
            <FiDownload size={16} />
            Export History
          </button>
        </div>
      </div>

      {/* Wallet Overview */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '24px',
        marginBottom: '32px'
      }}>
        <div className="card" style={{
          background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
          color: 'white'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'rgba(255, 255, 255, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <FaCoins size={24} />
            </div>
            <span style={{
              fontSize: '14px',
              padding: '4px 12px',
              background: 'rgba(255, 255, 255, 0.2)',
              borderRadius: '20px'
            }}>
              {walletData.level}
            </span>
          </div>
          <div style={{fontSize: '32px', fontWeight: '700', marginBottom: '8px'}}>
            {walletData.balance} pts
          </div>
          <div style={{opacity: 0.9}}>Available Balance</div>
        </div>

        <div className="card">
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: '#dcfce7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <FiTrendingUp size={24} color="#16a34a" />
            </div>
          </div>
          <div style={{fontSize: '24px', fontWeight: '700', color: '#111827', marginBottom: '8px'}}>
            {walletData.totalEarned} pts
          </div>
          <div style={{color: '#6b7280'}}>Total Earned</div>
        </div>

        <div className="card">
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: '#fee2e2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <FiClock size={24} color="#dc2626" />
            </div>
          </div>
          <div style={{fontSize: '24px', fontWeight: '700', color: '#111827', marginBottom: '8px'}}>
            {walletData.totalSpent} pts
          </div>
          <div style={{color: '#6b7280'}}>Total Spent</div>
        </div>
      </div>

      {/* Level Progress */}
      <div className="card" style={{marginBottom: '32px'}}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px'
        }}>
          <h3 style={{
            fontSize: '20px',
            fontWeight: '600',
            color: '#111827'
          }}>
            Level Progress
          </h3>
          <span style={{
            fontSize: '14px',
            color: '#6b7280'
          }}>
            {walletData.pointsToNext} pts to {walletData.nextLevel}
          </span>
        </div>
        <div style={{
          width: '100%',
          height: '8px',
          background: '#e5e7eb',
          borderRadius: '4px',
          overflow: 'hidden'
        }}>
          <div style={{
            width: `${((walletData.totalEarned - 1000) / 250) * 100}%`,
            height: '100%',
            background: `linear-gradient(90deg, ${getLevelColor(walletData.level)} 0%, ${getLevelColor(walletData.nextLevel)} 100%)`,
            borderRadius: '4px'
          }} />
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '14px',
          color: '#6b7280',
          marginTop: '8px'
        }}>
          <span>{walletData.level}</span>
          <span>{walletData.nextLevel}</span>
        </div>
      </div>

      {/* Community Contribution Stats */}
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
          <div style={{fontSize: '32px', marginBottom: '8px'}}>🎯</div>
          <div style={{fontSize: '24px', fontWeight: '700', marginBottom: '4px'}}>
            {communityStats.totalHelped}
          </div>
          <div style={{fontSize: '14px', opacity: 0.9}}>
            Items Found & Returned
          </div>
        </div>
        
        <div className="card" style={{
          background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
          color: 'white',
          textAlign: 'center'
        }}>
          <div style={{fontSize: '32px', marginBottom: '8px'}}>📝</div>
          <div style={{fontSize: '24px', fontWeight: '700', marginBottom: '4px'}}>
            {communityStats.totalReported}
          </div>
          <div style={{fontSize: '14px', opacity: 0.9}}>
            Lost Items Reported
          </div>
        </div>
        
        <div className="card" style={{
          background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
          color: 'white',
          textAlign: 'center'
        }}>
          <div style={{fontSize: '32px', marginBottom: '8px'}}>⭐</div>
          <div style={{fontSize: '24px', fontWeight: '700', marginBottom: '4px'}}>
            {walletData.totalEarned}
          </div>
          <div style={{fontSize: '14px', opacity: 0.9}}>
            Total Points Earned
          </div>
        </div>
        
        <div className="card" style={{
          background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
          color: 'white',
          textAlign: 'center'
        }}>
          <div style={{fontSize: '32px', marginBottom: '8px'}}>🏆</div>
          <div style={{fontSize: '24px', fontWeight: '700', marginBottom: '4px'}}>
            {walletData.level}
          </div>
          <div style={{fontSize: '14px', opacity: 0.9}}>
            Current Level
          </div>
        </div>
      </div>

      {/* Rewards Flow Explanation */}
      <div className="card" style={{
        background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)',
        border: '1px solid #bae6fd',
        marginBottom: '24px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          marginBottom: '20px'
        }}>
          <div style={{
            background: '#0ea5e9',
            borderRadius: '50%',
            padding: '12px',
            color: 'white'
          }}>
            <FiStar size={24} />
          </div>
          <div>
            <h3 style={{
              fontSize: '20px',
              fontWeight: '600',
              color: '#0c4a6e',
              margin: 0
            }}>
              How Rewards Work
            </h3>
            <p style={{
              color: '#0369a1',
              fontSize: '14px',
              margin: '4px 0 0 0'
            }}>
              Earn points when your lost items are found and verified
            </p>
          </div>
        </div>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '20px'
        }}>
          <div style={{
            background: 'white',
            padding: '16px',
            borderRadius: '8px',
            border: '1px solid #e0f2fe'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '8px'
            }}>
              <span style={{fontSize: '20px'}}>📝</span>
              <h4 style={{
                fontSize: '16px',
                fontWeight: '600',
                color: '#111827',
                margin: 0
              }}>
                Report Lost Item
              </h4>
            </div>
            <p style={{
              fontSize: '14px',
              color: '#6b7280',
              margin: 0,
              lineHeight: '1.5'
            }}>
              When you report a lost item, it gets added to our database for matching.
            </p>
          </div>
          
          <div style={{
            background: 'white',
            padding: '16px',
            borderRadius: '8px',
            border: '1px solid #e0f2fe'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '8px'
            }}>
              <span style={{fontSize: '20px'}}>🔍</span>
              <h4 style={{
                fontSize: '16px',
                fontWeight: '600',
                color: '#111827',
                margin: 0
              }}>
                Item Found & Claimed
              </h4>
            </div>
            <p style={{
              fontSize: '14px',
              color: '#6b7280',
              margin: 0,
              lineHeight: '1.5'
            }}>
              When someone finds your item and claims it through the hub.
            </p>
          </div>
          
          <div style={{
            background: 'white',
            padding: '16px',
            borderRadius: '8px',
            border: '1px solid #e0f2fe'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '8px'
            }}>
              <span style={{fontSize: '20px'}}>✅</span>
              <h4 style={{
                fontSize: '16px',
                fontWeight: '600',
                color: '#111827',
                margin: 0
              }}>
                Hub Verification
              </h4>
            </div>
            <p style={{
              fontSize: '14px',
              color: '#6b7280',
              margin: 0,
              lineHeight: '1.5'
            }}>
              Hub verifies the claim and approves it.
            </p>
          </div>
          
          <div style={{
            background: 'white',
            padding: '16px',
            borderRadius: '8px',
            border: '1px solid #e0f2fe'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '8px'
            }}>
              <span style={{fontSize: '20px'}}>🎉</span>
              <h4 style={{
                fontSize: '16px',
                fontWeight: '600',
                color: '#111827',
                margin: 0
              }}>
                Earn Points
              </h4>
            </div>
            <p style={{
              fontSize: '14px',
              color: '#6b7280',
              margin: 0,
              lineHeight: '1.5'
            }}>
              You earn <strong style={{color: '#10b981'}}>50 points</strong> for your lost item being found!
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="card">
        <div style={{
          display: 'flex',
          borderBottom: '1px solid #e5e7eb',
          marginBottom: '24px'
        }}>
          {[
            { id: 'overview', label: 'Rewards', icon: FiGift },
            { id: 'history', label: 'Transaction History', icon: FiClock },
            { id: 'achievements', label: 'Achievements', icon: FiAward }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1,
                padding: '16px',
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === tab.id ? '2px solid #3b82f6' : '2px solid transparent',
                color: activeTab === tab.id ? '#3b82f6' : '#6b7280',
                fontWeight: activeTab === tab.id ? '600' : '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Rewards Tab */}
        {activeTab === 'overview' && (
          <div>
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
                Available Rewards
              </h3>
            </div>
            
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '20px'
            }}>
              {rewardsCatalog.map(reward => (
                <div key={reward.id} style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: '12px',
                  padding: '20px',
                  background: 'white'
                }}>
                  <div style={{
                    display: 'flex',
                    gap: '16px',
                    marginBottom: '16px'
                  }}>
                    <img 
                      src={reward.image} 
                      alt={reward.name}
                      style={{
                        width: '60px',
                        height: '60px',
                        borderRadius: '8px',
                        objectFit: 'cover'
                      }}
                    />
                    <div style={{flex: 1}}>
                      <h4 style={{
                        fontSize: '16px',
                        fontWeight: '600',
                        color: '#111827',
                        marginBottom: '4px'
                      }}>
                        {reward.name}
                      </h4>
                      <p style={{
                        fontSize: '14px',
                        color: '#6b7280',
                        marginBottom: '8px'
                      }}>
                        {reward.description}
                      </p>
                      <span style={{
                        fontSize: '12px',
                        padding: '4px 8px',
                        background: '#f3f4f6',
                        borderRadius: '4px',
                        color: '#6b7280'
                      }}>
                        {reward.category}
                      </span>
                    </div>
                  </div>
                  
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      color: '#f59e0b',
                      fontWeight: '600'
                    }}>
                      <FaCoins size={16} />
                      <span>{reward.points} pts</span>
                    </div>
                    <button
                      onClick={() => handleRedeem(reward)}
                      className="btn"
                      style={{
                        background: reward.available && walletData.balance >= reward.points ? '#3b82f6' : '#e5e7eb',
                        color: reward.available && walletData.balance >= reward.points ? 'white' : '#9ca3af',
                        padding: '8px 16px',
                        fontSize: '14px'
                      }}
                      disabled={!reward.available || walletData.balance < reward.points}
                    >
                      {reward.available && walletData.balance >= reward.points ? 'Redeem' : 'Unavailable'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Transaction History Tab */}
        {activeTab === 'history' && (
          <div>
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
                Transaction History
              </h3>
            </div>
            
            <div style={{
              display: 'grid',
              gap: '12px'
            }}>
              {transactions.map(transaction => (
                <div key={transaction.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '16px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  background: '#f9fafb'
                }}>
                  <div style={{flex: 1}}>
                    <div style={{
                      fontSize: '16px',
                      fontWeight: '500',
                      color: '#111827',
                      marginBottom: '4px'
                    }}>
                      {transaction.description}
                    </div>
                    <div style={{
                      fontSize: '14px',
                      color: '#6b7280',
                      marginBottom: '4px'
                    }}>
                      {transaction.date}
                    </div>
                    {transaction.itemType && (
                      <div style={{
                        fontSize: '12px',
                        color: transaction.itemType === 'lost' ? '#059669' : '#3b82f6',
                        background: transaction.itemType === 'lost' ? '#ecfdf5' : '#eff6ff',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        display: 'inline-block',
                        fontWeight: '500',
                        marginTop: '4px'
                      }}>
                        {transaction.itemType === 'lost' ? '🔍 Your Lost Item Found & Verified' : '🎯 Found Item Successfully Returned'}
                      </div>
                    )}
                  </div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <span style={{
                      fontSize: '18px',
                      fontWeight: '600',
                      color: transaction.type === 'earned' ? '#10b981' : '#ef4444'
                    }}>
                      {transaction.type === 'earned' ? '+' : ''}{transaction.amount} pts
                    </span>
                    <span style={{
                      fontSize: '12px',
                      padding: '4px 8px',
                      background: transaction.status === 'completed' ? '#dcfce7' : '#fef3c7',
                      color: transaction.status === 'completed' ? '#16a34a' : '#d97706',
                      borderRadius: '4px',
                      fontWeight: '500'
                    }}>
                      {transaction.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Achievements Tab */}
        {activeTab === 'achievements' && (
          <div>
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
                Achievements
              </h3>
            </div>
            
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '20px'
            }}>
              {achievements.map(achievement => (
                <div key={achievement.id} style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: '12px',
                  padding: '20px',
                  background: achievement.earned ? 'white' : '#f9fafb'
                }}>
                  <div style={{
                    display: 'flex',
                    gap: '16px',
                    alignItems: 'center'
                  }}>
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '12px',
                      background: achievement.earned ? '#dcfce7' : '#e5e7eb',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <achievement.icon size={24} color={achievement.earned ? '#16a34a' : '#9ca3af'} />
                    </div>
                    <div style={{flex: 1}}>
                      <h4 style={{
                        fontSize: '16px',
                        fontWeight: '600',
                        color: '#111827',
                        marginBottom: '4px'
                      }}>
                        {achievement.name}
                      </h4>
                      <p style={{
                        fontSize: '14px',
                        color: '#6b7280',
                        marginBottom: '8px'
                      }}>
                        {achievement.description}
                      </p>
                      {achievement.earned ? (
                        <span style={{
                          fontSize: '12px',
                          color: '#16a34a',
                          fontWeight: '500'
                        }}>
                          Earned on {achievement.date}
                        </span>
                      ) : achievement.progress ? (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          <div style={{
                            flex: 1,
                            height: '4px',
                            background: '#e5e7eb',
                            borderRadius: '2px',
                            overflow: 'hidden'
                          }}>
                            <div style={{
                              width: `${(achievement.progress / 10) * 100}%`,
                              height: '100%',
                              background: '#3b82f6',
                              borderRadius: '2px'
                            }} />
                          </div>
                          <span style={{
                            fontSize: '12px',
                            color: '#6b7280'
                          }}>
                            {achievement.progress}/10
                          </span>
                        </div>
                      ) : (
                        <span style={{
                          fontSize: '12px',
                          color: '#9ca3af'
                        }}>
                          Not earned yet
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}






