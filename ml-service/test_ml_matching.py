#!/usr/bin/env python3
"""
Test script for ML matching and fraud detection system
"""

import requests
import json
import base64
import io
from PIL import Image
import numpy as np

# ML Service URL
ML_SERVICE_URL = "http://localhost:5001"

def create_test_image():
    """Create a simple test image"""
    # Create a simple red square image
    img = Image.new('RGB', (224, 224), color='red')
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    img_str = base64.b64encode(buffer.getvalue()).decode()
    return img_str

def test_fraud_detection():
    """Test fraud detection endpoint"""
    print("🔍 Testing Fraud Detection...")
    
    # Test case 1: Low risk item
    low_risk_data = {
        "item_details": {
            "name": "Blue backpack",
            "description": "Lost my blue backpack at the library yesterday. It has my books and laptop inside.",
            "location": "Central Library, Downtown",
            "category": "bag"
        },
        "user_details": {
            "name": "John Smith",
            "email": "john.smith@email.com",
            "phone": "+1234567890"
        }
    }
    
    # Test case 2: High risk item
    high_risk_data = {
        "item_details": {
            "name": "URGENT! EXPENSIVE iPhone 15 Pro Max",
            "description": "URGENT! URGENT! URGENT! Lost my brand new expensive iPhone 15 Pro Max with gold diamond case. REWARD REWARD REWARD REWARD REWARD",
            "location": "unknown",
            "category": "electronics"
        },
        "user_details": {
            "name": "X",
            "email": "x@x.com",
            "phone": "000"
        }
    }
    
    try:
        # Test low risk
        response = requests.post(f"{ML_SERVICE_URL}/detect-fraud", json=low_risk_data)
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Low Risk Test: Score={result['fraud_score']}, Level={result['risk_level']}")
            print(f"   Indicators: {result['indicators']}")
        else:
            print(f"❌ Low Risk Test Failed: {response.status_code}")
        
        # Test high risk
        response = requests.post(f"{ML_SERVICE_URL}/detect-fraud", json=high_risk_data)
        if response.status_code == 200:
            result = response.json()
            print(f"✅ High Risk Test: Score={result['fraud_score']}, Level={result['risk_level']}")
            print(f"   Indicators: {result['indicators']}")
        else:
            print(f"❌ High Risk Test Failed: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Fraud Detection Test Error: {e}")

def test_lost_found_matching():
    """Test lost-found matching endpoint"""
    print("\n🔗 Testing Lost-Found Matching...")
    
    # Create test image
    test_image = create_test_image()
    
    # Test case: Matching items
    matching_data = {
        "lost_item": {
            "name": "Red backpack",
            "description": "Lost my red backpack with laptop compartment",
            "location": "University Campus",
            "category": "bag",
            "date": "2024-01-15",
            "image": test_image
        },
        "found_item": {
            "name": "Red backpack",
            "description": "Found a red backpack with laptop compartment",
            "location": "University Campus",
            "category": "bag", 
            "date": "2024-01-16",
            "image": test_image
        },
        "user_history": {
            "recent_claims": 2,
            "similar_claims": 0
        }
    }
    
    try:
        response = requests.post(f"{ML_SERVICE_URL}/match-lost-found", json=matching_data)
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Matching Test: Match Score={result['match_result']['match_score']}%")
            print(f"   Confidence: {result['match_result']['confidence_level']}")
            print(f"   Recommendation: {result['recommendation']}")
            print(f"   Fraud Risk: {result['fraud_analysis']['overall_risk_level']} ({result['fraud_analysis']['overall_fraud_score']}/100)")
            print(f"   Hub Notes: {result['hub_notes']}")
        else:
            print(f"❌ Matching Test Failed: {response.status_code}")
            print(f"   Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Matching Test Error: {e}")

def test_image_search():
    """Test image search functionality"""
    print("\n📸 Testing Image Search...")
    
    test_image = create_test_image()
    
    search_data = {
        "image": test_image,
        "item_type": "found",
        "limit": 5
    }
    
    try:
        response = requests.post(f"{ML_SERVICE_URL}/search-by-image", json=search_data)
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Image Search Test: Found {len(result['results'])} results")
            if result['results']:
                print(f"   Best Match: {result['results'][0]['similarity_score']}% similarity")
        else:
            print(f"❌ Image Search Test Failed: {response.status_code}")
            
    except Exception as e:
        print(f"❌ Image Search Test Error: {e}")

def main():
    """Run all tests"""
    print("🚀 Starting ML Matching and Fraud Detection Tests\n")
    
    # Test fraud detection
    test_fraud_detection()
    
    # Test lost-found matching
    test_lost_found_matching()
    
    # Test image search
    test_image_search()
    
    print("\n✅ All tests completed!")

if __name__ == "__main__":
    main()

