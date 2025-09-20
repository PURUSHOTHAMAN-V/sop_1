from flask import Flask, request, jsonify
import numpy as np
try:
    import cv2
except Exception:
    cv2 = None
import base64
import io
from PIL import Image
try:
    from thefuzz import fuzz
except Exception:
    fuzz = None
import logging
import sqlite3
import os
from datetime import datetime
import json
try:
    import torch
    import torchvision.transforms as transforms
    import torchvision.models as models
except Exception:
    torch = None
    transforms = None
    models = None
try:
    from sklearn.metrics.pairwise import cosine_similarity
except Exception:
    cosine_similarity = None
import pickle
try:
    from transformers import AutoTokenizer, AutoModel
except Exception:
    AutoTokenizer = None
    AutoModel = None

app = Flask(__name__)

# Set port for the ML service
PORT = 5002

# Configure logging
logging.basicConfig(level=logging.INFO, 
                   format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
                   handlers=[logging.FileHandler("ml_service.log"),
                             logging.StreamHandler()])
logger = logging.getLogger(__name__)

# Database connection for storing item features
DB_PATH = 'item_features.db'

def init_database():
    """Initialize SQLite database for storing item features and claims"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS item_features (
            item_id INTEGER PRIMARY KEY,
            item_type TEXT NOT NULL,
            item_name TEXT,
            category TEXT,
            description TEXT,
            location TEXT,
            date TEXT,
            image_features BLOB,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Table for tracking claims
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS item_claims (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lost_item_id INTEGER NOT NULL,
            found_item_id INTEGER NOT NULL,
            claimer_user_id INTEGER NOT NULL,
            claim_status TEXT DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            match_score REAL,
            fraud_score REAL,
            UNIQUE(lost_item_id, found_item_id, claimer_user_id)
        )
    ''')
    
    conn.commit()
    conn.close()

# Initialize database on startup
init_database()

# Initialize ResNet50 model for image feature extraction
def init_resnet_model():
    """Initialize ResNet50 model for feature extraction"""
    try:
        if models is None or torch is None:
            raise RuntimeError('Torch/torchvision unavailable')
        model = models.resnet50(pretrained=True)
        model.eval()  # Set to evaluation mode
        # Remove the final classification layer to get features
        model = torch.nn.Sequential(*list(model.children())[:-1])
        logger.info("ResNet50 model loaded successfully")
        return model
    except Exception as e:
        logger.error(f"Failed to load ResNet50 model: {e}")
        return None

# Global model variable
resnet_model = init_resnet_model()

# Initialize BERT model for text embeddings (mean pooled)
def init_text_model():
    try:
        if AutoTokenizer is None or AutoModel is None or torch is None:
            raise RuntimeError('Transformers/Torch unavailable')
        tokenizer = AutoTokenizer.from_pretrained('bert-base-uncased')
        model = AutoModel.from_pretrained('bert-base-uncased')
        model.eval()
        logger.info("BERT model loaded successfully")
        return tokenizer, model
    except Exception as e:
        logger.error(f"Failed to load BERT model: {e}")
        return None, None

text_tokenizer, text_model = init_text_model()

# Image preprocessing for ResNet50
def preprocess_image_for_resnet(image_data):
    """Preprocess image for ResNet50 feature extraction"""
    try:
        if transforms is None:
            return None
        # Decode base64 image
        if isinstance(image_data, str) and image_data.startswith('data:image'):
            image_data = image_data.split(',')[1]
        
        image_bytes = base64.b64decode(image_data)
        image = Image.open(io.BytesIO(image_bytes))
        
        # Convert to RGB if needed
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Resize to 224x224 (ResNet50 input size)
        image = image.resize((224, 224))
        
        # Convert to tensor and normalize
        transform = transforms.Compose([
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
        ])
        
        tensor = transform(image).unsqueeze(0)  # Add batch dimension
        return tensor
    except Exception as e:
        logger.error(f"Error preprocessing image for ResNet: {e}")
        return None

def extract_resnet_features(image_tensor):
    """Extract features using ResNet50"""
    try:
        if resnet_model is None or torch is None:
            logger.warning("ResNet50 model not available, falling back to ORB features")
            return None
            
        with torch.no_grad():
            features = resnet_model(image_tensor)
            # Flatten the features
            features = features.squeeze().numpy()
            return features
    except Exception as e:
        logger.error(f"Error extracting ResNet features: {e}")
        return None

def mean_pool_last_hidden_state(last_hidden_state, attention_mask):
    try:
        mask = attention_mask.unsqueeze(-1).expand(last_hidden_state.size()).float()
        masked = last_hidden_state * mask
        summed = torch.sum(masked, dim=1)
        counts = torch.clamp(mask.sum(dim=1), min=1e-9)
        return (summed / counts).squeeze(0).detach().numpy()
    except Exception as e:
        logger.error(f"Error in mean pooling: {e}")
        return None

def encode_text_to_embedding(text):
    """Encode input text into a fixed-size embedding using BERT with mean pooling"""
    try:
        if not text or text.strip() == '':
            return None
        if text_tokenizer is None or text_model is None or torch is None:
            return None
        inputs = text_tokenizer(text, return_tensors='pt', truncation=True, max_length=256)
        with torch.no_grad():
            outputs = text_model(**inputs)
        embedding = mean_pool_last_hidden_state(outputs.last_hidden_state, inputs['attention_mask'])
        return embedding
    except Exception as e:
        logger.error(f"Error encoding text: {e}")
        return None

def cosine_sim(a, b):
    try:
        if a is None or b is None or cosine_similarity is None:
            return 0.0
        a2 = np.array(a).reshape(1, -1)
        b2 = np.array(b).reshape(1, -1)
        return float(cosine_similarity(a2, b2)[0][0])
    except Exception as e:
        logger.error(f"Error computing cosine similarity: {e}")
        return 0.0

def compute_feature_set(lost_item, found_item):
    """Compute feature-level similarities between lost and found items"""
    # Text: combine name + description
    lost_text = f"{lost_item.get('name','')} {lost_item.get('description','')}".strip()
    found_text = f"{found_item.get('name','')} {found_item.get('description','')}".strip()
    lost_emb = encode_text_to_embedding(lost_text)
    found_emb = encode_text_to_embedding(found_text)
    text_similarity = cosine_sim(lost_emb, found_emb)

    # Category similarity (fallback to fuzzy if BERT unavailable)
    category_similarity = calculate_text_similarity(lost_item.get('category',''), found_item.get('category',''))

    # Location similarity (fuzzy)
    location_similarity = calculate_text_similarity(lost_item.get('location',''), found_item.get('location',''))

    # Time similarity and temporal features
    time_similarity = 0.0
    time_to_claim_days = None
    lost_dow = None
    found_dow = None
    lost_date = lost_item.get('date') or lost_item.get('date_lost')
    found_date = found_item.get('date') or found_item.get('date_found')
    if lost_date and found_date:
        try:
            lost_dt = datetime.strptime(lost_date, '%Y-%m-%d')
            found_dt = datetime.strptime(found_date, '%Y-%m-%d')
            days_diff = abs((lost_dt - found_dt).days)
            time_similarity = max(0.0, 1.0 - (days_diff / 30.0))
            time_to_claim_days = days_diff
            lost_dow = lost_dt.weekday()
            found_dow = found_dt.weekday()
        except Exception:
            time_similarity = 0.0

    # Image similarity via ResNet if possible
    image_similarity = 0.0
    if lost_item.get('image') and found_item.get('image'):
        try:
            lt = preprocess_image_for_resnet(lost_item['image'])
            ft = preprocess_image_for_resnet(found_item['image'])
            if lt is not None and ft is not None:
                lf = extract_resnet_features(lt)
                ff = extract_resnet_features(ft)
                if lf is not None and ff is not None:
                    image_similarity = cosine_sim(lf, ff)
        except Exception as e:
            logger.error(f"Image similarity error: {e}")

    # Spatial distance (if lat/lng provided)
    def to_float(x):
        try:
            return float(x)
        except Exception:
            return None
    lost_lat = to_float(lost_item.get('lat'))
    lost_lng = to_float(lost_item.get('lng'))
    found_lat = to_float(found_item.get('lat'))
    found_lng = to_float(found_item.get('lng'))
    distance_km = None
    location_proximity = 0.0
    if all(v is not None for v in [lost_lat, lost_lng, found_lat, found_lng]):
        try:
            # Haversine
            from math import radians, sin, cos, asin, sqrt
            R = 6371.0
            dlat = radians(found_lat - lost_lat)
            dlon = radians(found_lng - lost_lng)
            a = sin(dlat/2)**2 + cos(radians(lost_lat))*cos(radians(found_lat))*sin(dlon/2)**2
            c = 2*asin(sqrt(a))
            distance_km = R*c
            # Proximity similarity: 0km -> 1.0, 5km+ -> ~0.0
            location_proximity = max(0.0, 1.0 - min(distance_km/5.0, 1.0))
        except Exception:
            distance_km = None
            location_proximity = 0.0

    features = {
        'text_similarity': float(max(0.0, min(1.0, text_similarity))) if text_emb_avail() else float(calculate_text_similarity(lost_text, found_text)),
        'category_similarity': float(max(0.0, min(1.0, category_similarity))),
        'location_similarity': float(max(0.0, min(1.0, location_similarity))),
        'location_proximity': float(max(0.0, min(1.0, location_proximity))),
        'time_similarity': float(max(0.0, min(1.0, time_similarity))),
        'image_similarity': float(max(0.0, min(1.0, image_similarity)))
    }
    return features, {
        'distance_km': distance_km,
        'time_to_claim_days': time_to_claim_days,
        'lost_day_of_week': lost_dow,
        'found_day_of_week': found_dow
    }

def text_emb_avail():
    return text_tokenizer is not None and text_model is not None

def compute_match_score(features):
    # Weighted average with emphasis on text and image
    w = {
        'text_similarity': 0.35,
        'category_similarity': 0.10,
        'location_similarity': 0.10,
        'location_proximity': 0.10,
        'time_similarity': 0.10,
        'image_similarity': 0.25
    }
    score = sum(features[k] * w[k] for k in w)
    return float(round(score * 100.0, 1))

fraud_model = None
fraud_model_path = 'fraud_model.pkl'

def load_or_train_fraud_model():
    global fraud_model
    try:
        if os.path.exists(fraud_model_path):
            with open(fraud_model_path, 'rb') as f:
                fraud_model = pickle.load(f)
            logger.info("Loaded fraud model from disk")
            return
    except Exception as e:
        logger.warning(f"Failed to load fraud model: {e}")

    # Train a small RandomForest on synthetic data aligned to intuition
    try:
        from sklearn.ensemble import RandomForestClassifier
        rng = np.random.default_rng(42)
        n = 2000
        # Features: text, category, location, time, image
        X = rng.random((n, 5))
        # Label: higher similarities => lower fraud probability
        base = 1.0 - (0.4*X[:,0] + 0.15*X[:,1] + 0.15*X[:,2] + 0.1*X[:,3] + 0.2*X[:,4])
        noise = rng.normal(0, 0.1, n)
        y_prob = np.clip(base + noise, 0, 1)
        y = (y_prob > 0.5).astype(int)  # 1 = fraud, 0 = not fraud
        clf = RandomForestClassifier(n_estimators=200, random_state=42, class_weight='balanced')
        clf.fit(X, y)
        fraud_model = clf
        with open(fraud_model_path, 'wb') as f:
            pickle.dump(fraud_model, f)
        logger.info("Trained and saved synthetic fraud model")
    except Exception as e:
        logger.error(f"Failed to train fraud model: {e}")
        fraud_model = None

load_or_train_fraud_model()

def get_risk_level(fraud_score):
    """Get risk level based on fraud score"""
    if fraud_score < 20:
        return "Low"
    elif fraud_score < 50:
        return "Medium"
    elif fraud_score < 80:
        return "High"
    else:
        return "Critical"

def get_fraud_analysis(fraud_score):
    """Get fraud analysis based on fraud score"""
    risk_level = get_risk_level(fraud_score)
    
    if risk_level == "Low":
        return {
            "status": "low_risk",
            "message": "Item appears legitimate with low fraud indicators",
            "recommended_action": "approve"
        }
    elif risk_level == "Medium":
        return {
            "status": "moderate_risk", 
            "message": "Item has some fraud indicators, verification recommended",
            "recommended_action": "verify"
        }
    elif risk_level == "High":
        return {
            "status": "high_risk",
            "message": "Item shows significant fraud indicators, manual review required",
            "recommended_action": "manual_review"
        }
    else:
        return {
            "status": "critical_risk",
            "message": "Item shows critical fraud indicators, reject or thorough investigation required",
            "recommended_action": "reject"
        }

@app.get("/health")
def health():
    try:
        # Count items in SQLite database
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute("SELECT COUNT(*) FROM item_features WHERE item_type = 'found'")
        found_count = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM item_features WHERE item_type = 'lost'")
        lost_count = cursor.fetchone()[0]
        
        conn.close()
        
        return jsonify({
            "ok": True, 
            "message": "ML service is running",
            "found_items": found_count,
            "lost_items": lost_count
        })
    except Exception as e:
        return jsonify({
            "ok": True, 
            "message": "ML service is running",
            "found_items": 0,
            "lost_items": 0,
            "error": str(e)
        })

# Helper functions for image processing
def preprocess_image(image_data):
    """Convert base64 image to OpenCV format and extract ORB features"""
    try:
        if cv2 is None:
            return None
        # Decode base64 image
        if isinstance(image_data, str) and image_data.startswith('data:image'):
            # Handle data URL format
            image_data = image_data.split(',')[1]
        
        image_bytes = base64.b64decode(image_data)
        image = Image.open(io.BytesIO(image_bytes))
        
        # Convert to RGB if needed
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Convert to OpenCV format
        open_cv_image = np.array(image) 
        open_cv_image = open_cv_image[:, :, ::-1].copy() # Convert RGB to BGR
        
        # Resize image for consistent processing
        height, width = open_cv_image.shape[:2]
        if width > 800 or height > 800:
            scale = min(800/width, 800/height)
            new_width = int(width * scale)
            new_height = int(height * scale)
            open_cv_image = cv2.resize(open_cv_image, (new_width, new_height))
        
        # Convert to grayscale for feature extraction
        gray = cv2.cvtColor(open_cv_image, cv2.COLOR_BGR2GRAY)
        
        # Extract ORB features
        orb = cv2.ORB_create(nfeatures=1000)
        keypoints, descriptors = orb.detectAndCompute(gray, None)
        
        if descriptors is None or len(descriptors) == 0:
            return None
            
        return {
            "image": open_cv_image,
            "gray": gray,
            "keypoints": keypoints,
            "descriptors": descriptors
        }
    except Exception as e:
        logger.error(f"Error preprocessing image: {e}")
        return None

def calculate_image_similarity(desc1, desc2):
    """Calculate similarity between two image descriptors using feature matching"""
    try:
        if cv2 is None or desc1 is None or desc2 is None:
            return 0.0
            
        # Use BFMatcher with Hamming distance
        bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
        matches = bf.match(desc1, desc2)
        
        # Sort matches by distance
        matches = sorted(matches, key=lambda x: x.distance)
        
        # Calculate similarity score (0-1)
        if len(matches) > 0:
            # Use the average distance of top matches
            top_matches = matches[:min(50, len(matches))]
            avg_distance = sum(m.distance for m in top_matches) / len(top_matches)
            # Convert distance to similarity (lower distance = higher similarity)
            max_distance = 100  # Typical max distance for ORB
            similarity = max(0, 1 - (avg_distance / max_distance))
            return similarity
        else:
            return 0.0
    except Exception as e:
        logger.error(f"Error calculating image similarity: {e}")
        return 0.0

def calculate_color_similarity(img1, img2):
    """Calculate color histogram similarity"""
    try:
        if cv2 is None:
            return 0.0
        # Calculate histograms for each channel
        hist1 = cv2.calcHist([img1], [0, 1, 2], None, [8, 8, 8], [0, 256, 0, 256, 0, 256])
        hist2 = cv2.calcHist([img2], [0, 1, 2], None, [8, 8, 8], [0, 256, 0, 256, 0, 256])
        
        # Normalize histograms
        cv2.normalize(hist1, hist1, alpha=0, beta=1, norm_type=cv2.NORM_MINMAX)
        cv2.normalize(hist2, hist2, alpha=0, beta=1, norm_type=cv2.NORM_MINMAX)
        
        # Calculate correlation
        correlation = cv2.compareHist(hist1, hist2, cv2.HISTCMP_CORREL)
        return max(0, correlation)
    except Exception as e:
        logger.error(f"Error calculating color similarity: {e}")
        return 0.0

def calculate_text_similarity(text1, text2):
    """Calculate similarity between two text strings using fuzzy matching"""
    if not text1 or not text2:
        return 0.0
    
    try:
        if fuzz is None:
            # Fallback to simple string matching when thefuzz is not available
            text1_lower = text1.lower().strip()
            text2_lower = text2.lower().strip()
            
            # Exact match
            if text1_lower == text2_lower:
                return 1.0
            
            # Check if one is substring of another
            if text1_lower in text2_lower or text2_lower in text1_lower:
                return 0.7
            
            # Simple word overlap
            words1 = set(text1_lower.split())
            words2 = set(text2_lower.split())
            if len(words1) == 0 or len(words2) == 0:
                return 0.0
            
            intersection = words1.intersection(words2)
            union = words1.union(words2)
            return len(intersection) / len(union)
        
        # Use thefuzz if available
        ratio = fuzz.ratio(text1.lower(), text2.lower()) / 100.0
        partial_ratio = fuzz.partial_ratio(text1.lower(), text2.lower()) / 100.0
        token_sort_ratio = fuzz.token_sort_ratio(text1.lower(), text2.lower()) / 100.0
        
        # Weighted average
        return (0.3 * ratio + 0.4 * partial_ratio + 0.3 * token_sort_ratio)
    except Exception as e:
        logger.error(f"Error in text similarity calculation: {e}")
        return 0.0

def calculate_fraud_score_based_on_matching(lost_item, found_item, user_history=None):
    """Calculate fraud score based on actual similarity between lost and found items"""
    fraud_indicators = []
    total_score = 0
    
    # Extract item details
    lost_name = lost_item.get('name', '').lower()
    lost_desc = lost_item.get('description', '').lower()
    lost_category = lost_item.get('category', '').lower()
    lost_location = lost_item.get('location', '').lower()
    lost_date = lost_item.get('date', '')
    
    found_name = found_item.get('name', '').lower()
    found_desc = found_item.get('description', '').lower()
    found_category = found_item.get('category', '').lower()
    found_location = found_item.get('location', '').lower()
    found_date = found_item.get('date', '')
    
    # Calculate similarity scores
    name_similarity = calculate_text_similarity(lost_name, found_name)
    desc_similarity = calculate_text_similarity(lost_desc, found_desc)
    category_similarity = calculate_text_similarity(lost_category, found_category)
    location_similarity = calculate_text_similarity(lost_location, found_location)
    
    # Date proximity analysis
    date_similarity = 0
    if lost_date and found_date:
        try:
            from datetime import datetime
            lost_dt = datetime.strptime(lost_date, '%Y-%m-%d')
            found_dt = datetime.strptime(found_date, '%Y-%m-%d')
            days_diff = abs((lost_dt - found_dt).days)
            date_similarity = max(0, 1 - (days_diff / 30))  # 30 days max
        except:
            date_similarity = 0
    
    # Calculate overall match score
    overall_match = (
        name_similarity * 0.3 +
        desc_similarity * 0.25 +
        category_similarity * 0.2 +
        location_similarity * 0.15 +
        date_similarity * 0.1
    )
    
    # Fraud indicators based on matching analysis
    if overall_match < 0.3:
        fraud_indicators.append("Very low similarity between lost and found items")
        total_score += 40
    elif overall_match < 0.5:
        fraud_indicators.append("Low similarity between lost and found items")
        total_score += 25
    elif overall_match < 0.7:
        fraud_indicators.append("Moderate similarity - requires verification")
        total_score += 10
    
    # Specific fraud patterns
    if name_similarity < 0.2 and desc_similarity < 0.2:
        fraud_indicators.append("Name and description don't match")
        total_score += 30
    
    if category_similarity < 0.5:
        fraud_indicators.append("Category mismatch")
        total_score += 15
    
    if location_similarity < 0.3:
        fraud_indicators.append("Location mismatch")
        total_score += 10
    
    # Date analysis
    if lost_date and found_date:
        try:
            from datetime import datetime
            lost_dt = datetime.strptime(lost_date, '%Y-%m-%d')
            found_dt = datetime.strptime(found_date, '%Y-%m-%d')
            days_diff = abs((lost_dt - found_dt).days)
            
            if days_diff > 30:
                fraud_indicators.append("Large time gap between lost and found dates")
                total_score += 20
            elif days_diff > 14:
                fraud_indicators.append("Significant time gap between lost and found dates")
                total_score += 10
        except:
            pass
    
    # Check for suspicious patterns in descriptions
    suspicious_patterns = [
        'urgent', 'asap', 'reward', 'expensive', 'valuable', 'brand new',
        'iphone', 'samsung', 'macbook', 'laptop', 'jewelry', 'gold', 'diamond'
    ]
    
    combined_desc = f"{lost_desc} {found_desc}"
    pattern_matches = sum(1 for pattern in suspicious_patterns if pattern in combined_desc)
    if pattern_matches > 2:
        fraud_indicators.append(f"Multiple suspicious keywords detected ({pattern_matches})")
        total_score += min(pattern_matches * 5, 20)
    
    # Check for generic descriptions
    generic_phrases = [
        'lost item', 'found item', 'personal belongings', 'valuable item',
        'important document', 'electronic device', 'accessory'
    ]
    generic_matches = sum(1 for phrase in generic_phrases if phrase in combined_desc)
    if generic_matches > 0:
        fraud_indicators.append("Generic description detected")
        total_score += 8
    
    # User history analysis
    if user_history:
        recent_claims = user_history.get('recent_claims', 0)
        if recent_claims > 5:
            fraud_indicators.append(f"High number of recent claims ({recent_claims})")
            total_score += min(recent_claims * 3, 20)
        
        similar_claims = user_history.get('similar_claims', 0)
        if similar_claims > 2:
            fraud_indicators.append(f"Multiple similar claims ({similar_claims})")
            total_score += min(similar_claims * 5, 15)
    
    # Normalize score to 0-100
    fraud_score = min(total_score, 100)
    
    # Determine risk level
    if fraud_score < 20:
        risk_level = "Low"
    elif fraud_score < 50:
        risk_level = "Medium"
    elif fraud_score < 80:
        risk_level = "High"
    else:
        risk_level = "Critical"
    
    return {
        'fraud_score': fraud_score,
        'risk_level': risk_level,
        'indicators': fraud_indicators,
        'confidence': max(0, 100 - fraud_score),
        'match_analysis': {
            'overall_match_score': round(overall_match * 100, 1),
            'name_similarity': round(name_similarity * 100, 1),
            'description_similarity': round(desc_similarity * 100, 1),
            'category_similarity': round(category_similarity * 100, 1),
            'location_similarity': round(location_similarity * 100, 1),
            'date_similarity': round(date_similarity * 100, 1)
        }
    }

def calculate_fraud_score(item_details, user_history=None):
    """Calculate fraud risk score based on item details and user history"""
    fraud_indicators = []
    total_score = 0
    
    # Check for suspicious patterns in item description
    description = item_details.get('description', '').lower()
    name = item_details.get('name', '').lower()
    
    # Suspicious keywords that might indicate fraud
    suspicious_keywords = [
        'urgent', 'asap', 'reward', 'expensive', 'valuable', 'brand new',
        'iphone', 'samsung', 'macbook', 'laptop', 'jewelry', 'gold', 'diamond',
        'wallet', 'purse', 'handbag', 'watch', 'ring', 'necklace'
    ]
    
    keyword_matches = sum(1 for keyword in suspicious_keywords if keyword in description or keyword in name)
    if keyword_matches > 3:
        fraud_indicators.append(f"Multiple suspicious keywords detected ({keyword_matches})")
        total_score += min(keyword_matches * 5, 25)
    
    # Check for unrealistic descriptions
    if len(description) < 10:
        fraud_indicators.append("Very short description")
        total_score += 10
    elif len(description) > 500:
        fraud_indicators.append("Excessively long description")
        total_score += 5
    
    # Check for repeated words (potential copy-paste)
    words = description.split()
    if len(words) > 0:
        word_counts = {}
        for word in words:
            word_counts[word] = word_counts.get(word, 0) + 1
        max_repetition = max(word_counts.values())
        if max_repetition > 3:
            fraud_indicators.append("Repetitive text detected")
            total_score += 15
    
    # Check location patterns
    location = item_details.get('location', '').lower()
    if not location or location in ['unknown', 'n/a', 'not specified']:
        fraud_indicators.append("Missing or vague location")
        total_score += 5
    
    # Check for generic descriptions
    generic_phrases = [
        'lost item', 'found item', 'personal belongings', 'valuable item',
        'important document', 'electronic device', 'accessory'
    ]
    generic_matches = sum(1 for phrase in generic_phrases if phrase in description)
    if generic_matches > 0:
        fraud_indicators.append("Generic description detected")
        total_score += 8
    
    # Check user history if available
    if user_history:
        # Check for multiple recent claims
        recent_claims = user_history.get('recent_claims', 0)
        if recent_claims > 5:
            fraud_indicators.append(f"High number of recent claims ({recent_claims})")
            total_score += min(recent_claims * 3, 20)
        
        # Check for similar previous claims
        similar_claims = user_history.get('similar_claims', 0)
        if similar_claims > 2:
            fraud_indicators.append(f"Multiple similar claims ({similar_claims})")
            total_score += min(similar_claims * 5, 15)
    
    # Normalize score to 0-100
    fraud_score = min(total_score, 100)
    
    # Determine risk level
    if fraud_score < 20:
        risk_level = "Low"
    elif fraud_score < 50:
        risk_level = "Medium"
    elif fraud_score < 80:
        risk_level = "High"
    else:
        risk_level = "Critical"
    
    return {
        'fraud_score': fraud_score,
        'risk_level': risk_level,
        'indicators': fraud_indicators,
        'confidence': max(0, 100 - fraud_score)
    }

def calculate_match_confidence(lost_item, found_item, image_similarity=0):
    """Calculate overall match confidence between lost and found items"""
    # Text similarity scores
    name_sim = calculate_text_similarity(lost_item.get('name', ''), found_item.get('name', ''))
    desc_sim = calculate_text_similarity(lost_item.get('description', ''), found_item.get('description', ''))
    category_sim = calculate_text_similarity(lost_item.get('category', ''), found_item.get('category', ''))
    location_sim = calculate_text_similarity(lost_item.get('location', ''), found_item.get('location', ''))
    
    # Date proximity (if both have dates)
    date_sim = 0
    if lost_item.get('date') and found_item.get('date'):
        try:
            from datetime import datetime
            lost_date = datetime.strptime(lost_item['date'], '%Y-%m-%d')
            found_date = datetime.strptime(found_item['date'], '%Y-%m-%d')
            days_diff = abs((lost_date - found_date).days)
            # Higher similarity for closer dates
            date_sim = max(0, 1 - (days_diff / 30))  # 30 days max
        except:
            date_sim = 0
    
    # Weighted combination
    if image_similarity > 0:
        # If we have image data, weight it heavily
        match_score = (
            name_sim * 0.25 +
            desc_sim * 0.25 +
            category_sim * 0.15 +
            location_sim * 0.10 +
            date_sim * 0.10 +
            image_similarity * 0.15
        ) * 100
    else:
        # Text-only matching
        match_score = (
            name_sim * 0.35 +
            desc_sim * 0.35 +
            category_sim * 0.15 +
            location_sim * 0.10 +
            date_sim * 0.05
        ) * 100
    
    # Determine confidence level
    if match_score >= 85:
        confidence_level = "Very High"
    elif match_score >= 70:
        confidence_level = "High"
    elif match_score >= 50:
        confidence_level = "Medium"
    elif match_score >= 30:
        confidence_level = "Low"
    else:
        confidence_level = "Very Low"
    
    return {
        'match_score': round(match_score, 1),
        'confidence_level': confidence_level,
        'breakdown': {
            'name_similarity': round(name_sim * 100, 1),
            'description_similarity': round(desc_sim * 100, 1),
            'category_similarity': round(category_sim * 100, 1),
            'location_similarity': round(location_sim * 100, 1),
            'date_similarity': round(date_sim * 100, 1),
            'image_similarity': round(image_similarity * 100, 1) if image_similarity > 0 else None
        }
    }

@app.post("/match-image")
def match_image():
    payload = request.get_json(silent=True) or {}
    
    # Extract data from payload
    image_data = payload.get("image")
    item_type = payload.get("item_type", "lost")  # 'lost' or 'found'
    item_details = payload.get("item_details", {})
    
    # For demo purposes, return enhanced dummy results
    dummy_results = [
        {
            "item_id": 101, 
            "name": "iPhone 12",
            "category": "Electronics",
            "description": "Black iPhone with red case",
            "location": "Central Park",
            "date": "2024-05-15",
            "match_score": 92,
            "image_similarity": 95,
            "metadata_similarity": 88
        },
        {
            "item_id": 305, 
            "name": "Samsung Galaxy S21",
            "category": "Electronics",
            "description": "Blue smartphone with clear case",
            "location": "Main Street",
            "date": "2024-05-10",
            "match_score": 87,
            "image_similarity": 82,
            "metadata_similarity": 91
        },
        {
            "item_id": 77, 
            "name": "Google Pixel 6",
            "category": "Electronics",
            "description": "Black smartphone",
            "location": "Coffee Shop",
            "date": "2024-05-05",
            "match_score": 81,
            "image_similarity": 78,
            "metadata_similarity": 85
        },
    ]
    
    # Determine next steps based on match scores
    next_step = "reject"
    if dummy_results and dummy_results[0]["match_score"] >= 80:
        next_step = "approve_online"
    elif dummy_results and dummy_results[0]["match_score"] >= 50:
        next_step = "request_verification"
    
    return jsonify({
        "ok": True,
        "query": {
            "item_type": item_type,
            "details": item_details
        },
        "results": dummy_results,
        "match_found": len(dummy_results) > 0,
        "best_match_score": dummy_results[0]["match_score"] if dummy_results else 0,
        "next_step": next_step
    })


@app.post("/match-text")
def match_text():
    payload = request.get_json(silent=True) or {}
    
    # Extract query text and metadata
    query_text = payload.get("text", "")
    item_name = payload.get("item_name", "")
    category = payload.get("category", "")
    description = payload.get("description", "")
    location = payload.get("location", "")
    date = payload.get("date", "")
    
    # Combine text fields for matching
    combined_text = f"{item_name} {category} {description}".strip()
    
    # For demo purposes, return enhanced dummy results with similarity scores
    dummy_results = [
        {
            "item_id": 101, 
            "name": "iPhone 12",
            "category": "Electronics",
            "description": "Black iPhone with red case",
            "location": "Central Park",
            "date": "2024-05-15",
            "match_score": 89,
            "name_similarity": 92,
            "category_similarity": 100,
            "description_similarity": 75,
            "location_similarity": 0,  # Different location
            "date_similarity": 90      # Close date
        },
        {
            "item_id": 305, 
            "name": "Samsung Galaxy S21",
            "category": "Electronics",
            "description": "Blue smartphone with clear case",
            "location": "Main Street",
            "date": "2024-05-10",
            "match_score": 78,
            "name_similarity": 65,
            "category_similarity": 100,
            "description_similarity": 70,
            "location_similarity": 0,  # Different location
            "date_similarity": 85      # Close date
        },
        {
            "item_id": 77, 
            "name": "Google Pixel 6",
            "category": "Electronics",
            "description": "Black smartphone",
            "location": "Coffee Shop",
            "date": "2024-05-05",
            "match_score": 65,
            "name_similarity": 40,
            "category_similarity": 100,
            "description_similarity": 60,
            "location_similarity": 0,  # Different location
            "date_similarity": 75      # Further date
        },
    ]
    
    # Determine next steps based on match scores
    next_step = "reject"
    if dummy_results and dummy_results[0]["match_score"] >= 80:
        next_step = "approve_online"
    elif dummy_results and dummy_results[0]["match_score"] >= 50:
        next_step = "request_verification"
    
    return jsonify({
        "ok": True,
        "query": {
            "text": combined_text,
            "item_name": item_name,
            "category": category,
            "description": description,
            "location": location,
            "date": date
        },
        "results": dummy_results,
        "match_found": len(dummy_results) > 0,
        "best_match_score": dummy_results[0]["match_score"] if dummy_results else 0,
        "next_step": next_step
    })


@app.post("/detect-fraud")
def detect_fraud():
    """Enhanced fraud detection endpoint"""
    payload = request.get_json(silent=True) or {}
    
    # Extract item and user details
    item_details = payload.get("item_details", {})
    user_details = payload.get("user_details", {})
    
    # Combine details for fraud analysis
    combined_details = {
        **item_details,
        "user_name": user_details.get("name", ""),
        "user_email": user_details.get("email", ""),
        "user_phone": user_details.get("phone", "")
    }
    
    try:
        # Calculate fraud score using matching-based algorithm
        item_name = item_details.get('name', '')
        description = item_details.get('description', '')
        category = item_details.get('category', '')
        location = item_details.get('location', '')
        user_id = user_details.get('id', 0)
        item_type = item_details.get('type', 'found')
        
        # Create dummy lost/found items for fraud analysis
        dummy_item = {
            'name': item_name,
            'description': description,
            'category': category,
            'location': location,
            'date': item_details.get('date', '')
        }
        
        fraud_result = calculate_fraud_score(dummy_item, user_details)
        fraud_score = fraud_result['fraud_score']
        
        return jsonify({
            "ok": True,
            "fraud_score": fraud_score,
            "risk_level": fraud_result.get('risk_level', get_risk_level(fraud_score)),
            "indicators": fraud_result.get('indicators', []),
            "confidence": fraud_result.get('confidence', 50),
            "analysis": get_fraud_analysis(fraud_score),
            "details": {
                "analysis_method": "matching_based_detection",
                "input_processed": True
            }
        })
    except Exception as e:
        logger.error(f"Error in fraud detection: {e}")
        return jsonify({
            "ok": True,
            "fraud_score": 50,  # Default moderate risk
            "risk_level": "Medium",
            "indicators": ["Analysis error - manual review recommended"],
            "confidence": 50,
            "details": {"error": str(e)}
        })


@app.post("/store-item")
def store_item():
    """Store a found or lost item in the database for future matching"""
    payload = request.get_json(silent=True) or {}
    
    # Extract item details
    item_type = payload.get("item_type", "found")  # 'found' or 'lost'
    item_id = payload.get("item_id")
    item_name = payload.get("item_name", "")
    category = payload.get("category", "")
    description = payload.get("description", "")
    location = payload.get("location", "")
    date = payload.get("date", "")
    image_data = payload.get("image")
    
    try:
        # Process image if available
        image_features_blob = None
        if image_data:
            # Try ResNet50 features first
            image_tensor = preprocess_image_for_resnet(image_data)
            if image_tensor is not None:
                resnet_features = extract_resnet_features(image_tensor)
                if resnet_features is not None:
                    # Store ResNet50 features
                    image_features_blob = pickle.dumps(resnet_features)
                    logger.info(f"Stored ResNet50 features for item {item_id}")
                else:
                    # Fallback to ORB features
                    processed_image = preprocess_image(image_data)
                    if processed_image and processed_image["descriptors"] is not None:
                        image_features_blob = processed_image["descriptors"].tobytes()
                        logger.info(f"Stored ORB features for item {item_id}")
            else:
                # Fallback to ORB features
                processed_image = preprocess_image(image_data)
                if processed_image and processed_image["descriptors"] is not None:
                    image_features_blob = processed_image["descriptors"].tobytes()
                    logger.info(f"Stored ORB features for item {item_id}")
        
        # Store in SQLite database
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Insert or update item features
        cursor.execute('''
            INSERT OR REPLACE INTO item_features 
            (item_id, item_type, item_name, category, description, location, date, image_features)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (item_id, item_type, item_name, category, description, location, date, image_features_blob))
        
        conn.commit()
        conn.close()
        
        logger.info(f"Stored {item_type} item: {item_id} with features")
        return jsonify({
            "ok": True,
            "message": f"Item successfully stored in {item_type} items database",
            "item_id": item_id,
            "available_for_matching": True,
            "has_image_features": image_features_blob is not None
        })
    except Exception as e:
        logger.error(f"Error storing item {item_id}: {e}")
        return jsonify({
            "ok": False,
            "error": str(e),
            "item_id": item_id
        })


@app.post("/search-by-image")
def search_by_image():
    """Search for similar items using image similarity"""
    payload = request.get_json(silent=True) or {}
    
    # Extract image data
    image_data = payload.get("image")
    item_type = payload.get("item_type", "lost")  # 'lost' or 'found'
    limit = payload.get("limit", 10)
    
    if not image_data:
        return jsonify({
            "ok": False,
            "error": "Image data is required for image search"
        })
    
    try:
        # Extract features from query image
        query_tensor = preprocess_image_for_resnet(image_data)
        if query_tensor is None:
            return jsonify({
                "ok": False,
                "error": "Failed to process query image"
            })
        
        query_features = extract_resnet_features(query_tensor)
        if query_features is None:
            return jsonify({
                "ok": False,
                "error": "Failed to extract features from query image"
            })
        
        # Get items from database to search against
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Determine which items to search against
        search_type = "found" if item_type == "lost" else "lost"
        
        cursor.execute('''
            SELECT item_id, item_name, category, description, location, date, image_features
            FROM item_features 
            WHERE item_type = ? AND image_features IS NOT NULL
            ORDER BY created_at DESC
        ''', (search_type,))
        
        stored_items = cursor.fetchall()
        conn.close()
        
        results = []
        
        for stored_item in stored_items:
            stored_item_id, stored_name, stored_category, stored_desc, stored_location, stored_date, stored_features_blob = stored_item
            
            try:
                # Load stored features
                stored_features = pickle.loads(stored_features_blob)
                
                # Calculate cosine similarity
                if stored_features is not None and len(stored_features.shape) == 1:
                    # Ensure both features are 2D for cosine_similarity
                    query_features_2d = query_features.reshape(1, -1)
                    stored_features_2d = stored_features.reshape(1, -1)
                    
                    similarity = cosine_similarity(query_features_2d, stored_features_2d)[0][0]
                    similarity_score = float(similarity * 100)  # Convert to percentage
                    
                    # Only include items with reasonable similarity
                    if similarity_score >= 30:  # Minimum threshold
                        results.append({
                            "item_id": stored_item_id,
                            "name": stored_name,
                            "category": stored_category,
                            "description": stored_desc,
                            "location": stored_location,
                            "date": stored_date,
                            "similarity_score": round(similarity_score, 1),
                            "match_confidence": "High" if similarity_score >= 80 else "Medium" if similarity_score >= 60 else "Low"
                        })
            except Exception as e:
                logger.error(f"Error processing stored features for item {stored_item_id}: {e}")
                continue
        
        # Sort by similarity score (highest first)
        results.sort(key=lambda x: x["similarity_score"], reverse=True)
        
        # Limit results
        results = results[:limit]
        
        return jsonify({
            "ok": True,
            "query": {
                "item_type": item_type,
                "search_method": "resnet50_image_similarity"
            },
            "results": results,
            "total_matches": len(results),
            "best_match_score": results[0]["similarity_score"] if results else 0,
            "search_successful": len(results) > 0
        })
        
    except Exception as e:
        logger.error(f"Error in search_by_image: {e}")
        return jsonify({
            "ok": False,
            "error": str(e),
            "results": [],
            "search_successful": False
        })

@app.post("/analyze-claim-fraud")
def analyze_claim_fraud():
    """Analyze fraud risk for a specific claim by comparing lost and found items"""
    payload = request.get_json(silent=True) or {}
    
    # Extract claim details
    lost_item = payload.get("lost_item", {})
    found_item = payload.get("found_item", {})
    user_history = payload.get("user_history", {})
    
    if not lost_item or not found_item:
        return jsonify({
            "ok": False,
            "error": "Both lost_item and found_item are required"
        })
    
    try:
        # Calculate image similarity if both have images
        image_similarity = 0
        if lost_item.get('image') and found_item.get('image'):
            # Process both images
            lost_tensor = preprocess_image_for_resnet(lost_item['image'])
            found_tensor = preprocess_image_for_resnet(found_item['image'])
            
            if lost_tensor is not None and found_tensor is not None:
                lost_features = extract_resnet_features(lost_tensor)
                found_features = extract_resnet_features(found_tensor)
                
                if lost_features is not None and found_features is not None:
                    # Calculate cosine similarity
                    lost_features_2d = lost_features.reshape(1, -1)
                    found_features_2d = found_features.reshape(1, -1)
                    image_similarity = cosine_similarity(lost_features_2d, found_features_2d)[0][0]
        
        # Calculate fraud score based on matching
        fraud_result = calculate_fraud_score_based_on_matching(lost_item, found_item, user_history)
        
        # Calculate overall match confidence
        match_result = calculate_match_confidence(lost_item, found_item, image_similarity)
        
        # Generate recommendation
        if match_result['match_score'] >= 80 and fraud_result['fraud_score'] < 20:
            recommendation = "Strong Match - Recommend Approval"
        elif match_result['match_score'] >= 60 and fraud_result['fraud_score'] < 40:
            recommendation = "Good Match - Recommend Approval with Verification"
        elif match_result['match_score'] >= 40 and fraud_result['fraud_score'] < 60:
            recommendation = "Possible Match - Requires Manual Review"
        elif match_result['match_score'] >= 20:
            recommendation = "Weak Match - Requires Detailed Verification"
        else:
            recommendation = "No Match - Recommend Rejection"
        
        return jsonify({
            "ok": True,
            "fraud_analysis": fraud_result,
            "match_analysis": match_result,
            "image_similarity": round(image_similarity * 100, 1) if image_similarity > 0 else None,
            "recommendation": recommendation,
            "hub_notes": {
                "match_confidence": f"{match_result['confidence_level']} ({match_result['match_score']}%)",
                "fraud_risk": f"{fraud_result['risk_level']} Risk ({fraud_result['fraud_score']}/100)",
                "key_indicators": fraud_result['indicators'],
                "verification_required": fraud_result['fraud_score'] >= 30 or match_result['match_score'] < 70,
                "image_available": image_similarity > 0
            }
        })
    except Exception as e:
        logger.error(f"Error in analyze_claim_fraud: {e}")
        return jsonify({
            "ok": False,
            "error": str(e)
        })

@app.post("/compare-items")
def compare_items():
    """Compare a lost item and a found item and predict fraud probability.
    Input JSON: { lost_item: {...}, found_item: {...} }
    Output JSON: { match_score: X, fraud_probability: Y%, explanation: [...] }
    """
    payload = request.get_json(silent=True) or {}
    lost_item = payload.get('lost_item', {})
    found_item = payload.get('found_item', {})

    if not lost_item or not found_item:
        return jsonify({ "ok": False, "error": "lost_item and found_item are required" }), 400

    try:
        feats, aux = compute_feature_set(lost_item, found_item)
        match_score = compute_match_score(feats)

        # Prepare vector for classifier
        x_vec = np.array([
            feats['text_similarity'],
            feats['category_similarity'],
            feats['location_similarity'],
            feats['location_proximity'],
            feats['time_similarity'],
            feats['image_similarity']
        ]).reshape(1, -1)

        fraud_prob = 0.5
        feature_importance = None
        if fraud_model is not None:
            try:
                proba = fraud_model.predict_proba(x_vec)[0][1]
                fraud_prob = float(proba)
                feature_importance = getattr(fraud_model, 'feature_importances_', None)
            except Exception as e:
                logger.error(f"Fraud model inference error: {e}")

        # Build explanation
        explanations = []
        explanations.append(f"Text similarity: {round(feats['text_similarity']*100,1)}% (BERT{'+' if text_emb_avail() else '/fuzzy'} match)")
        explanations.append(f"Category similarity: {round(feats['category_similarity']*100,1)}%")
        explanations.append(f"Location similarity: {round(feats['location_similarity']*100,1)}%")
        explanations.append(f"Location proximity: {round(feats['location_proximity']*100,1)}%" + (f" (~{aux['distance_km']:.2f} km)" if aux.get('distance_km') is not None else ""))
        explanations.append(f"Time proximity: {round(feats['time_similarity']*100,1)}%" + (f" ({aux['time_to_claim_days']} days)" if aux.get('time_to_claim_days') is not None else ""))
        if feats['image_similarity'] > 0:
            explanations.append(f"Image similarity: {round(feats['image_similarity']*100,1)}% (ResNet50 cosine)")
        else:
            explanations.append("Image similarity: N/A (image not provided or features unavailable)")

        if feature_importance is not None:
            # Map importances to feature names
            names = ['text', 'category', 'location', 'time', 'image']
            ranked = sorted(zip(names, feature_importance.tolist()), key=lambda x: x[1], reverse=True)
            explanations.append("Model feature importance: " + ", ".join([f"{n}={round(v*100,1)}%" for n,v in ranked]))

        confidence_level = 'very_high' if match_score >= 90 else 'high' if match_score >= 70 else 'medium' if match_score >= 50 else 'low'
        return jsonify({
            "ok": True,
            "match_score": match_score,
            "fraud_probability": round(fraud_prob * 100.0, 1),
            "confidence_level": confidence_level,
            "explanation": {
                "match_factors": {
                    "text_similarity": round(feats['text_similarity']*100,1),
                    "image_similarity": round(feats['image_similarity']*100,1),
                    "location_proximity": round(feats['location_proximity']*100,1),
                    "time_alignment": round(feats['time_similarity']*100,1),
                    "category_match": round(feats['category_similarity']*100,1)
                },
                "fraud_indicators": {
                    "user_behavior_risk": "unknown",
                    "timing_anomaly": "none" if (aux.get('time_to_claim_days') is not None and aux['time_to_claim_days'] <= 30) else "possible",
                    "location_consistency": "high" if feats['location_proximity'] >= 0.7 else "medium" if feats['location_proximity'] >= 0.4 else "low",
                    "description_quality": "good" if feats['text_similarity'] >= 0.6 else "average",
                    "historical_patterns": "unknown"
                },
                "recommendation": "APPROVE_MATCH" if (match_score >= 90 and (fraud_prob * 100.0) < 10) else "REVIEW",
                "key_supporting_evidence": explanations
            }
        })
    except Exception as e:
        logger.error(f"compare_items error: {e}")
        return jsonify({ "ok": False, "error": str(e) }), 500

@app.post("/match-lost-found")
def match_lost_found():
    """Comprehensive matching between lost and found items with fraud detection"""
    payload = request.get_json(silent=True) or {}
    
    # Extract item details
    lost_item = payload.get("lost_item", {})
    found_item = payload.get("found_item", {})
    user_history = payload.get("user_history", {})
    
    if not lost_item or not found_item:
        return jsonify({
            "ok": False,
            "error": "Both lost_item and found_item are required"
        })
    
    try:
        # Calculate image similarity if both have images
        image_similarity = 0
        if lost_item.get('image') and found_item.get('image'):
            # Process both images
            lost_tensor = preprocess_image_for_resnet(lost_item['image'])
            found_tensor = preprocess_image_for_resnet(found_item['image'])
            
            if lost_tensor is not None and found_tensor is not None:
                lost_features = extract_resnet_features(lost_tensor)
                found_features = extract_resnet_features(found_tensor)
                
                if lost_features is not None and found_features is not None:
                    # Calculate cosine similarity
                    lost_features_2d = lost_features.reshape(1, -1)
                    found_features_2d = found_features.reshape(1, -1)
                    image_similarity = cosine_similarity(lost_features_2d, found_features_2d)[0][0]
        
        # Calculate match confidence
        match_result = calculate_match_confidence(lost_item, found_item, image_similarity)
        
        # Calculate fraud scores for both items
        lost_fraud = calculate_fraud_score(lost_item, user_history)
        found_fraud = calculate_fraud_score(found_item, user_history)
        
        # Calculate overall fraud risk
        overall_fraud_score = max(lost_fraud['fraud_score'], found_fraud['fraud_score'])
        overall_risk_level = "Critical" if overall_fraud_score >= 80 else "High" if overall_fraud_score >= 50 else "Medium" if overall_fraud_score >= 20 else "Low"
        
        # Generate match recommendation
        if match_result['match_score'] >= 70 and overall_fraud_score < 30:
            recommendation = "Strong Match - Recommend Approval"
        elif match_result['match_score'] >= 50 and overall_fraud_score < 50:
            recommendation = "Possible Match - Requires Verification"
        elif match_result['match_score'] >= 30:
            recommendation = "Weak Match - Manual Review Required"
        else:
            recommendation = "No Match - Reject"
        
        return jsonify({
            "ok": True,
            "match_result": match_result,
            "fraud_analysis": {
                "lost_item_fraud": lost_fraud,
                "found_item_fraud": found_fraud,
                "overall_fraud_score": overall_fraud_score,
                "overall_risk_level": overall_risk_level
            },
            "recommendation": recommendation,
            "hub_notes": {
                "match_confidence": f"{match_result['confidence_level']} ({match_result['match_score']}%)",
                "fraud_risk": f"{overall_risk_level} Risk ({overall_fraud_score}/100)",
                "key_indicators": lost_fraud['indicators'] + found_fraud['indicators'],
                "verification_required": overall_fraud_score >= 30 or match_result['match_score'] < 70
            }
        })
        
    except Exception as e:
        logger.error(f"Error in match_lost_found: {e}")
        return jsonify({
            "ok": False,
            "error": str(e)
        })

# Claim management functions
def get_item_claim_status(lost_item_id, found_item_id):
    """Check if an item pair has any pending claims"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT claimer_user_id, claim_status, created_at
            FROM item_claims 
            WHERE lost_item_id = ? AND found_item_id = ? AND claim_status = 'pending'
            ORDER BY created_at ASC
        ''', (lost_item_id, found_item_id))
        
        claims = cursor.fetchall()
        conn.close()
        
        if claims:
            return {
                "status": "claimed",
                "claimer_user_id": claims[0][0],
                "claim_date": claims[0][2],
                "total_pending_claims": len(claims)
            }
        else:
            return {"status": "available"}
            
    except Exception as e:
        logger.error(f"Error checking claim status: {e}")
        return {"status": "error", "error": str(e)}

@app.post("/create-claim")
def create_claim():
    """Create a new claim for a lost/found item pair"""
    payload = request.get_json(silent=True) or {}
    
    lost_item_id = payload.get("lost_item_id")
    found_item_id = payload.get("found_item_id")
    claimer_user_id = payload.get("claimer_user_id")
    lost_item = payload.get("lost_item", {})
    found_item = payload.get("found_item", {})
    
    if not all([lost_item_id, found_item_id, claimer_user_id]):
        return jsonify({
            "ok": False,
            "error": "lost_item_id, found_item_id, and claimer_user_id are required"
        })
    
    try:
        # Check if claim already exists
        claim_status = get_item_claim_status(lost_item_id, found_item_id)
        
        if claim_status["status"] == "claimed":
            return jsonify({
                "ok": False,
                "error": "Item pair already has a pending claim",
                "existing_claim": claim_status
            })
        
        # Calculate match and fraud scores if items provided
        match_score = None
        fraud_score = None
        
        if lost_item and found_item:
            try:
                feats, aux = compute_feature_set(lost_item, found_item)
                match_score = compute_match_score(feats)
                
                fraud_result = calculate_fraud_score_based_on_matching(lost_item, found_item)
                fraud_score = fraud_result['fraud_score']
            except Exception as e:
                logger.error(f"Error calculating scores for claim: {e}")
        
        # Create claim
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO item_claims 
            (lost_item_id, found_item_id, claimer_user_id, match_score, fraud_score)
            VALUES (?, ?, ?, ?, ?)
        ''', (lost_item_id, found_item_id, claimer_user_id, match_score, fraud_score))
        
        claim_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        logger.info(f"Created claim {claim_id} for user {claimer_user_id}")
        
        return jsonify({
            "ok": True,
            "claim_id": claim_id,
            "status": "pending",
            "match_score": match_score,
            "fraud_score": fraud_score,
            "message": "Claim created successfully"
        })
        
    except Exception as e:
        logger.error(f"Error creating claim: {e}")
        return jsonify({
            "ok": False,
            "error": str(e)
        })

@app.post("/check-claim-status")
def check_claim_status():
    """Check the claim status for an item pair"""
    payload = request.get_json(silent=True) or {}
    
    lost_item_id = payload.get("lost_item_id")
    found_item_id = payload.get("found_item_id")
    user_id = payload.get("user_id")  # Optional: to check if this user has claimed it
    
    if not lost_item_id or not found_item_id:
        return jsonify({
            "ok": False,
            "error": "lost_item_id and found_item_id are required"
        })
    
    try:
        claim_status = get_item_claim_status(lost_item_id, found_item_id)
        
        # Add user-specific information if user_id provided
        if user_id and claim_status["status"] == "claimed":
            claim_status["is_current_user_claim"] = claim_status["claimer_user_id"] == user_id
        
        return jsonify({
            "ok": True,
            "claim_status": claim_status
        })
        
    except Exception as e:
        logger.error(f"Error checking claim status: {e}")
        return jsonify({
            "ok": False,
            "error": str(e)
        })

@app.post("/update-claim-status")
def update_claim_status():
    """Update claim status (approve/reject)"""
    payload = request.get_json(silent=True) or {}
    
    claim_id = payload.get("claim_id")
    new_status = payload.get("status")  # 'approved', 'rejected', 'pending'
    admin_notes = payload.get("admin_notes", "")
    
    if not claim_id or not new_status:
        return jsonify({
            "ok": False,
            "error": "claim_id and status are required"
        })
    
    if new_status not in ['approved', 'rejected', 'pending']:
        return jsonify({
            "ok": False,
            "error": "status must be 'approved', 'rejected', or 'pending'"
        })
    
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute('''
            UPDATE item_claims 
            SET claim_status = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', (new_status, claim_id))
        
        if cursor.rowcount == 0:
            conn.close()
            return jsonify({
                "ok": False,
                "error": "Claim not found"
            })
        
        conn.commit()
        conn.close()
        
        logger.info(f"Updated claim {claim_id} status to {new_status}")
        
        return jsonify({
            "ok": True,
            "message": f"Claim status updated to {new_status}",
            "claim_id": claim_id,
            "new_status": new_status
        })
        
    except Exception as e:
        logger.error(f"Error updating claim status: {e}")
        return jsonify({
            "ok": False,
            "error": str(e)
        })

@app.post("/match-item")
def match_item():
    """Match a lost item against all found items or a found item against all lost items"""
    payload = request.get_json(silent=True) or {}
    
    # Extract item details
    item_type = payload.get("item_type", "lost")  # 'lost' or 'found'
    item_name = payload.get("item_name", "")
    category = payload.get("category", "")
    description = payload.get("description", "")
    location = payload.get("location", "")
    date = payload.get("date", "")
    image_data = payload.get("image")
    
    try:
        # Process image if available
        query_image_features = None
        query_image = None
        if image_data:
            processed_image = preprocess_image(image_data)
            if processed_image:
                query_image_features = processed_image["descriptors"]
                query_image = processed_image["image"]
        
        # Get items from database to match against
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Determine which items to search against
        search_type = "found" if item_type == "lost" else "lost"
        
        cursor.execute('''
            SELECT item_id, item_name, category, description, location, date, image_features
            FROM item_features 
            WHERE item_type = ?
            ORDER BY created_at DESC
        ''', (search_type,))
        
        stored_items = cursor.fetchall()
        conn.close()
        
        results = []
        
        for stored_item in stored_items:
            stored_item_id, stored_name, stored_category, stored_desc, stored_location, stored_date, stored_features_blob = stored_item
            
            # Calculate text similarity
            name_similarity = calculate_text_similarity(item_name, stored_name)
            desc_similarity = calculate_text_similarity(description, stored_desc)
            category_similarity = calculate_text_similarity(category, stored_category)
            location_similarity = calculate_text_similarity(location, stored_location)
            
            # Calculate metadata similarity (weighted average)
            metadata_similarity = (
                name_similarity * 0.4 +
                desc_similarity * 0.3 +
                category_similarity * 0.2 +
                location_similarity * 0.1
            )
            
            # Calculate image similarity if both images available
            image_similarity = 0.0
            if query_image_features is not None and stored_features_blob:
                try:
                    stored_features = np.frombuffer(stored_features_blob, dtype=np.uint8)
                    stored_features = stored_features.reshape(-1, 32)  # ORB descriptors are 32 bytes
                    image_similarity = calculate_image_similarity(query_image_features, stored_features)
                except Exception as e:
                    logger.error(f"Error calculating image similarity for item {stored_item_id}: {e}")
            
            # Calculate overall match score
            if image_similarity > 0:
                # If we have image data, weight it heavily
                match_score = (image_similarity * 0.7 + metadata_similarity * 0.3) * 100
            else:
                # If no image data, rely on metadata only
                match_score = metadata_similarity * 100
            
            # Only include items with reasonable match scores
            if match_score >= 30:  # Minimum threshold
                results.append({
                    "item_id": stored_item_id,
                    "name": stored_name,
                    "category": stored_category,
                    "description": stored_desc,
                    "location": stored_location,
                    "date": stored_date,
                    "match_score": round(match_score, 1),
                    "image_similarity": round(image_similarity * 100, 1) if image_similarity > 0 else None,
                    "metadata_similarity": round(metadata_similarity * 100, 1),
                    "name_similarity": round(name_similarity * 100, 1),
                    "description_similarity": round(desc_similarity * 100, 1),
                    "category_similarity": round(category_similarity * 100, 1),
                    "location_similarity": round(location_similarity * 100, 1)
                })
        
        # Sort by match score (highest first)
        results.sort(key=lambda x: x["match_score"], reverse=True)
        
        # Limit to top 10 results
        results = results[:10]
    
        # Determine next steps based on match scores
        next_step = "reject"
        if results and results[0]["match_score"] >= 80:
            next_step = "approve_online"
        elif results and results[0]["match_score"] >= 50:
            next_step = "request_verification"

        return jsonify({
            "ok": True,
            "query": {
                "item_type": item_type,
                "item_name": item_name,
                "category": category,
                "description": description,
                "location": location,
                "date": date
            },
            "results": results,
            "match_found": len(results) > 0,
            "best_match_score": results[0]["match_score"] if results else 0,
            "next_step": next_step
        })
        
    except Exception as e:
        logger.error(f"Error in match_item: {e}")
        return jsonify({
            "ok": False,
            "error": str(e),
            "results": [],
            "match_found": False
        })


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=PORT)


