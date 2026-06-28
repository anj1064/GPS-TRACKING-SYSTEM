#include <WiFi.h>
#include <HTTPClient.h>
#include <TinyGPS++.h>
#include <SoftwareSerial.h>

// WiFi credentials
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// Server endpoint
const char* serverUrl = "http://YOUR_SERVER_IP:3000/api/location";

// Employee Info
const String employeeId = "EMP101";
const String employeeName = "Rahul Sharma";

// GPS Module Connection (RX, TX)
static const int RXPin = 16, TXPin = 17;
static const uint32_t GPSBaud = 9600;

TinyGPSPlus gps;
SoftwareSerial ss(RXPin, TXPin);

void setup() {
  Serial.begin(115200);
  ss.begin(GPSBaud);

  // Connect to WiFi
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nConnected to WiFi");
}

void loop() {
  // Read data from GPS module
  while (ss.available() > 0) {
    if (gps.encode(ss.read())) {
      sendLocationData();
    }
  }

  // If 5 seconds pass and no characters coming in
  if (millis() > 5000 && gps.charsProcessed() < 10) {
    Serial.println(F("No GPS data received: check wiring"));
    while(true);
  }
}

void sendLocationData() {
  if (gps.location.isValid()) {
    if ((WiFi.status() == WL_CONNECTED)) {
      HTTPClient http;
      http.begin(serverUrl);
      http.addHeader("Content-Type", "application/json");

      // Construct JSON payload
      String jsonPayload = "{";
      jsonPayload += "\"employeeId\":\"" + employeeId + "\",";
      jsonPayload += "\"name\":\"" + employeeName + "\",";
      jsonPayload += "\"lat\":" + String(gps.location.lat(), 6) + ",";
      jsonPayload += "\"lng\":" + String(gps.location.lng(), 6);
      jsonPayload += "}";

      // Send HTTP POST request
      int httpResponseCode = http.POST(jsonPayload);

      if (httpResponseCode > 0) {
        String response = http.getString();
        Serial.println(httpResponseCode);
        Serial.println(response);
      } else {
        Serial.print("Error on sending POST: ");
        Serial.println(httpResponseCode);
      }
      http.end();
    }
    // Delay before next update to prevent spamming the server
    delay(10000); // 10 seconds
  }
}
