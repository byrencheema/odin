#!/usr/bin/env python3
"""
ODIN ATC Console Backend API Testing
Tests OpenSky Network integration and basic API endpoints
"""

import requests
import sys
import json
from datetime import datetime
from typing import Dict, Any, List

class ODINBackendTester:
    def __init__(self, base_url="https://skywatcher-7.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name: str, success: bool, details: str = "", response_data: Any = None):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}: PASSED")
        else:
            print(f"❌ {name}: FAILED - {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details,
            "response_data": response_data
        })

    def test_root_endpoint(self):
        """Test basic API root endpoint"""
        try:
            response = requests.get(f"{self.api_url}/", timeout=10)
            success = response.status_code == 200
            data = response.json() if success else {}
            
            self.log_test(
                "Root API Endpoint", 
                success,
                f"Status: {response.status_code}" if not success else "",
                data
            )
            return success, data
        except Exception as e:
            self.log_test("Root API Endpoint", False, f"Exception: {str(e)}")
            return False, {}

    def test_opensky_endpoint(self):
        """Test OpenSky aircraft data endpoint"""
        try:
            print(f"\n🔍 Testing OpenSky endpoint: {self.api_url}/air/opensky")
            response = requests.get(f"{self.api_url}/air/opensky", timeout=15)
            
            if response.status_code == 200:
                data = response.json()
                
                # Validate response structure
                required_fields = ["aircraft", "timestamp", "data_status", "aircraft_count", "bbox"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if missing_fields:
                    self.log_test(
                        "OpenSky Response Structure", 
                        False, 
                        f"Missing fields: {missing_fields}",
                        data
                    )
                    return False, data
                
                # Check aircraft data
                aircraft_count = len(data.get("aircraft", []))
                print(f"   📊 Aircraft count: {aircraft_count}")
                print(f"   📊 Data status: {data.get('data_status')}")
                print(f"   📊 Timestamp: {data.get('timestamp')}")
                
                # Validate aircraft structure if any exist
                if aircraft_count > 0:
                    sample_aircraft = data["aircraft"][0]
                    aircraft_fields = ["icao24", "callsign", "origin_country", "longitude", "latitude"]
                    missing_aircraft_fields = [field for field in aircraft_fields if field not in sample_aircraft]
                    
                    if missing_aircraft_fields:
                        self.log_test(
                            "Aircraft Data Structure", 
                            False, 
                            f"Missing aircraft fields: {missing_aircraft_fields}",
                            sample_aircraft
                        )
                    else:
                        self.log_test("Aircraft Data Structure", True, f"Sample aircraft has required fields")
                
                self.log_test(
                    "OpenSky Endpoint", 
                    True, 
                    f"Retrieved {aircraft_count} aircraft, status: {data.get('data_status')}",
                    {"aircraft_count": aircraft_count, "data_status": data.get("data_status")}
                )
                return True, data
                
            elif response.status_code == 503:
                # Service unavailable - expected for data issues
                try:
                    error_data = response.json()
                    self.log_test(
                        "OpenSky Endpoint", 
                        False, 
                        f"Service unavailable (503): {error_data.get('detail', 'No details')}",
                        error_data
                    )
                except:
                    self.log_test(
                        "OpenSky Endpoint", 
                        False, 
                        f"Service unavailable (503): No JSON response"
                    )
                return False, {}
            else:
                self.log_test(
                    "OpenSky Endpoint", 
                    False, 
                    f"HTTP {response.status_code}: {response.text[:200]}..."
                )
                return False, {}
                
        except requests.exceptions.Timeout:
            self.log_test("OpenSky Endpoint", False, "Request timeout (15s)")
            return False, {}
        except Exception as e:
            self.log_test("OpenSky Endpoint", False, f"Exception: {str(e)}")
            return False, {}

    def test_status_endpoints(self):
        """Test basic status check endpoints"""
        try:
            # Test POST status
            test_data = {"client_name": f"test_client_{datetime.now().strftime('%H%M%S')}"}
            response = requests.post(f"{self.api_url}/status", json=test_data, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                self.log_test("Status POST", True, "Status check created", data)
                
                # Test GET status
                get_response = requests.get(f"{self.api_url}/status", timeout=10)
                if get_response.status_code == 200:
                    get_data = get_response.json()
                    self.log_test("Status GET", True, f"Retrieved {len(get_data)} status checks")
                    return True
                else:
                    self.log_test("Status GET", False, f"HTTP {get_response.status_code}")
            else:
                self.log_test("Status POST", False, f"HTTP {response.status_code}")
                
        except Exception as e:
            self.log_test("Status Endpoints", False, f"Exception: {str(e)}")
        
        return False

    def run_all_tests(self):
        """Run all backend tests"""
        print(f"🚀 Starting ODIN ATC Console Backend Tests")
        print(f"🌐 Base URL: {self.base_url}")
        print(f"🔗 API URL: {self.api_url}")
        print("=" * 60)
        
        # Test basic connectivity
        self.test_root_endpoint()
        
        # Test status endpoints (basic CRUD)
        self.test_status_endpoints()
        
        # Test main OpenSky endpoint
        opensky_success, opensky_data = self.test_opensky_endpoint()
        
        # Summary
        print("\n" + "=" * 60)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return 0
        else:
            print("⚠️  Some tests failed. Check details above.")
            return 1

def main():
    tester = ODINBackendTester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())