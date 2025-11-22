#include <TinyGPS++.h>
#include <SoftwareSerial.h>
#include <AltSoftSerial.h>

#define SIM900_TX 2
#define SIM900_RX 3
SoftwareSerial sim900A(SIM900_TX, SIM900_RX);

AltSoftSerial gpsSerial;
TinyGPSPlus gps;

const char APN[] = "internet.globe.com.ph";
const char HOST[] = "34.67.115.65";
const int PORT = 80;
int shuttleId = 1;

unsigned long previousMillis = 0;
const long interval = 10000;

void setup() {
  Serial.begin(9600);
  sim900A.begin(9600);
  gpsSerial.begin(9600);

  Serial.println("Initializing SIM900A...");
  delay(3000);

  sendAT("AT");
  sendAT("ATE0");
  sendAT("AT+CPIN?");
  sendAT("AT+CREG?");
  sendAT("AT+CGATT=1");

  // APN setup
  sim900A.print("AT+CSTT=\"");
  sim900A.print(APN);
  sim900A.println("\"");
  ShowSerialData();
  delay(2000);

  sendAT("AT+CIICR");
  delay(3000);
  sendAT("AT+CIFSR");
  delay(2000);

  sendAT("AT+CIPMUX=0");
  sendAT("AT+CIPHEAD=1"); // show +IPD header (optional)
  Serial.println("GPRS ready!");
}

void loop() {
  while (gpsSerial.available()) gps.encode(gpsSerial.read());

  if (millis() - previousMillis >= interval) {
    previousMillis = millis();
    sendGpsToServer();
  }
}

void sendGpsToServer() {
  if (!gps.location.isValid()) {
    Serial.println("No valid GPS fix yet...");
    return;
  }

  String lat = String(gps.location.lat(), 6);
  String lon = String(gps.location.lng(), 6);
  String json = "{\"shuttle_id\":" + String(shuttleId) +
                ",\"latitude\":" + lat +
                ",\"longitude\":" + lon + "}";

  Serial.println("Latitude=" + lat + " Longitude=" + lon);
  Serial.println("Sending JSON: " + json);

  sim900A.print("AT+CIPSTART=\"TCP\",\"");
  sim900A.print(HOST);
  sim900A.print("\",\"");
  sim900A.print(PORT);
  sim900A.println("\"");
  ShowSerialData();
  delay(5000);

  sim900A.println("AT+CIPSEND");
  delay(1000);
  ShowSerialData();

  String req =
    "POST /relay HTTP/1.1\r\n"
    "Host: " + String(HOST) + "\r\n"
    "Content-Type: application/json\r\n"
    "Content-Length: " + String(json.length()) + "\r\n"
    "Connection: close\r\n\r\n" +
    json + "\r\n";

  sim900A.print(req);
  delay(500);
  sim900A.write(26); // Ctrl+Z
  delay(4000);
  ShowSerialData();

  sendAT("AT+CIPCLOSE");
  delay(1000);
}

void sendAT(String cmd) {
  sim900A.println(cmd);
  ShowSerialData();
  delay(800);
}

void ShowSerialData() {
  while (sim900A.available()) {
    Serial.write(sim900A.read());
  }
}
