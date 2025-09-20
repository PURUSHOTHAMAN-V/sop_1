#!/usr/bin/env python3
"""
Test script for image search functionality
"""
import requests
import base64
import json
from PIL import Image
import io

def create_test_image():
    """Create a simple test image"""
    # Create a simple red rectangle image
    img = Image.new('RGB', (224, 224), color='red')
    
    # Convert to base64
    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    img_str = base64.b64encode(buffer.getvalue()).decode()
    
    return f"data:image/png;base64,{img_str}"

def test_image_search():
    """Test the image search endpoint"""
    print("🧪 Testing Image Search Functionality...")
    
    # Create test image
    test_image = create_test_image()
    print("✅ Test image created")
    
    # Test ML service health
    try:
        health_response = requests.get("http://localhost:5001/health")
        if health_response.status_code == 200:
            print("✅ ML service is running")
        else:
            print("❌ ML service health check failed")
            return
    except requests.exceptions.ConnectionError:
        print("❌ ML service is not running. Please start it first.")
        return
    
    # Test image search endpoint
    try:
        search_payload = {
            "image": test_image,
            "item_type": "lost",
            "limit": 5
        }
        
        response = requests.post(
            "http://localhost:5001/search-by-image",
            json=search_payload,
            headers={"Content-Type": "application/json"}
        )
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Image search endpoint working")
            print(f"📊 Search results: {data.get('total_matches', 0)} matches found")
            print(f"🎯 Best match score: {data.get('best_match_score', 0)}%")
            print(f"🔍 Search method: {data.get('query', {}).get('search_method', 'unknown')}")
        else:
            print(f"❌ Image search failed: {response.status_code}")
            print(response.text)
            
    except Exception as e:
        print(f"❌ Error testing image search: {e}")

if __name__ == "__main__":
    test_image_search()

