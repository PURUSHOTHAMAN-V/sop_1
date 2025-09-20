# Hub Claims Page - Complete User Information Display

## Overview
The Hub Claims Management page now displays comprehensive information for each claim request, including both item details and user details (who made the claim).

## Features Implemented

### 1. **Dual View Modes**
- **Card View**: Detailed cards with prominent user information section
- **Table View**: Organized table format with all columns visible

### 2. **Complete Information Display**

#### Item Details:
- Item Name
- Category (Found/Lost)
- Description
- Lost Date / Found Date
- Status (Pending / Approved / Rejected / Partial Verification)
- Location
- Fraud Score (with color coding)

#### User Details (Claimant Information):
- **User Name** - Full name of the person who claimed the item
- **Email** - Contact email address
- **Phone** - Contact phone number

### 3. **Enhanced UI Layout**

#### Card View Features:
- Prominent "Claimant Details" section with blue background
- User information displayed in organized grid
- Email and phone icons for easy identification
- All user details visible at a glance

#### Table View Features:
- Complete table with columns: Item Name | Category | Description | Date | User Name | Email | Phone | Status | Fraud Score | Actions
- Responsive design with horizontal scrolling
- Action buttons for each claim (View, Approve, Reject, Partial Verification)

### 4. **Action Buttons**
- **View Details**: Opens detailed modal with complete information
- **Approve**: Approves the claim and rewards the finder
- **Reject**: Rejects the claim with optional message
- **Partial Verification**: Requires in-person verification

### 5. **Fraud Score Integration**
- Real-time fraud score calculation
- Color-coded display (Green: Low risk, Yellow: Medium risk, Red: High risk)
- Fraud score filtering slider (0-100 range)

## Technical Implementation

### Backend API (`/api/hub/claims`)
```sql
SELECT c.claim_id, c.user_id AS claimer_user_id, c.item_id, c.item_type, c.status, c.created_at,
       f.name AS item_name, f.description AS item_description, f.location AS item_location,
       f.user_id AS finder_user_id, f.date_found,
       u.name AS claimer_name, u.email AS claimer_email, u.phone AS claimer_phone
FROM claims c
JOIN found_items f ON c.item_id = f.item_id
JOIN users u ON c.user_id = u.user_id
WHERE c.item_type = 'found' AND c.status = $1
```

### Frontend Data Mapping
```javascript
const formattedClaims = response.claims.map(claim => ({
  id: claim.claim_id,
  item: claim.item_name,
  claimant: claim.claimer_name || 'Unknown User',
  claimantEmail: claim.claimer_email || 'No email provided',
  claimantPhone: claim.claimer_phone || 'No phone provided',
  // ... other fields
}));
```

## Usage Instructions

### For Hub Administrators:

1. **Access Claims**: Navigate to Hub Dashboard → Claims Management
2. **View Modes**: Toggle between Card View and Table View using the buttons
3. **Filter Claims**: Use the fraud score slider to filter by risk level
4. **Review Information**: 
   - Card View: See user details in highlighted blue section
   - Table View: See all information in organized columns
5. **Take Actions**: Use action buttons to approve, reject, or require verification
6. **View Details**: Click "View Details" for complete information modal

### Information Displayed:
- **Item**: What was lost/found
- **User**: Who is claiming it (Name, Email, Phone)
- **Status**: Current claim status
- **Risk**: Fraud score assessment
- **Actions**: Available actions based on status

## Security Features
- User contact information only visible to hub administrators
- Fraud score calculation based on user history and patterns
- Secure claim verification process
- Audit trail for all claim actions

## Benefits
- **Complete Transparency**: Hub staff can see all relevant information
- **Efficient Processing**: Table view allows quick scanning of multiple claims
- **Risk Assessment**: Fraud scores help prioritize claims
- **User Communication**: Direct access to claimant contact information
- **Flexible Viewing**: Choose between detailed cards or organized table

This implementation ensures hub administrators have all necessary information to make informed decisions about claim requests while maintaining security and efficiency.