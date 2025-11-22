#include <TinyGPS++.h>
#include <SoftwareSerial.h>
#include <AltSoftSerial.h>

// --- Pin setup ---
#define SIM800_TX 2
#define SIM800_RX 3
SoftwareSerial sim800L(SIM800_TX, SIM800_RX);

AltSoftSerial neogps; // GPS: RX=8, TX=9
TinyGPSPlus gps;

unsigned long previousMillis = 0;
const long interval = 60000;  // send every 60s

const char APN[] = "internet.globe.com.ph";
const char HOST[] = "34.67.204.121";  // <-- change to your server IP or domain
const int PORT = 80;

int shuttleId = 1;

void setup() {
  Serial.begin(9600);
  sim800L.begin(9600);
  neogps.begin(9600);

  Serial.println("Initializing SIM800L...");
  delay(3000);

  sendAT("AT");
  sendAT("ATE0");       // disable echo
  sendAT("AT+CPIN?");   // check SIM
  sendAT("AT+CREG?");   // check network registration
  sendAT("AT+CGATT=1"); // attach GPRS

  // Setup PDP context
  sim800L.print("AT+CSTT=\"");
  sim800L.print(APN);
  sim800L.println("\"");
  ShowSerialData();
  delay(2000);

  sendAT("AT+CIICR");   // bring up wireless connection
  delay(3000);
  sendAT("AT+CIFSR");   // get local IP
  delay(2000);

  Serial.println("Ready to send GPS data!");
}

void loop() {
  // GPS parsing loop
  while (neogps.available()) gps.encode(neogps.read());

  unsigned long currentMillis = millis();
  if (currentMillis - previousMillis > interval) {
    previousMillis = currentMillis;
    sendGpsToServer();
  }

  // Print SIM800 responses
  while (sim800L.available()) Serial.write(sim800L.read());
}

void sendGpsToServer() {
  if (!gps.location.isValid()) {
    Serial.println("No valid GPS fix yet...");
    return;
  }

  String latitude = String(gps.location.lat(), 6);
  String longitude = String(gps.location.lng(), 6);

  String json = "{\"shuttle_id\":" + String(shuttleId) +
                ",\"latitude\":" + latitude +
                ",\"longitude\":" + longitude + "}";

  Serial.println("Latitude=" + latitude + " Longitude=" + longitude);
  Serial.println("Sending JSON:");
  Serial.println(json);

  // --- Prepare HTTP POST ---
  sendAT("AT+CIPSHUT");
  delay(2000);
  sendAT("AT+CIPMUX=0");

  // Set APN again (ensure clean start)
  sim800L.print("AT+CSTT=\"");
  sim800L.print(APN);
  sim800L.println("\"");
  ShowSerialData();
  delay(2000);

  sendAT("AT+CIICR");
  delay(3000);
  sendAT("AT+CIFSR");
  delay(2000);

  // Start TCP connection
  Serial.print("Connecting to ");
  Serial.print(HOST);
  Serial.print(":");
  Serial.println(PORT);

  sim800L.print("AT+CIPSTART=\"TCP\",\"");
  sim800L.print(HOST);
  sim800L.print("\",\"");
  sim800L.print(PORT);
  sim800L.println("\"");
  ShowSerialData();
  delay(6000);

  sim800L.println("AT+CIPSEND");
  delay(2000);
  ShowSerialData();

  // --- Compose HTTP POST request ---
  String httpReq =
    "POST /relay HTTP/1.1\r\n"
    "Host: " + String(HOST) + "\r\n"
    "Content-Type: application/json\r\n"
    "Content-Length: " + String(json.length()) + "\r\n"
    "Connection: close\r\n\r\n" +
    json + "\r\n";

  sim800L.print(httpReq);
  delay(2000);
  sim800L.write(26); // CTRL+Z to send
  delay(5000);
  ShowSerialData();

  sendAT("AT+CIPSHUT");
  delay(2000);

  Serial.println("Finished sending data.\n");
}

void sendAT(String cmd) {
  sim800L.println(cmd);
  ShowSerialData();
  delay(1000);
}

void ShowSerialData() {
  while (sim800L.available()) {
    Serial.write(sim800L.read());
  }
}
