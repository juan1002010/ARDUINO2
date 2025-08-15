#include <WiFi.h>
#include <WebServer.h>
#include <NTPClient.h>
#include <WiFiUdp.h>
#include <ArduinoJson.h>
#include <EEPROM.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

// ========== CONFIGURACION IMPORTANTE ==========
// CAMBIA ESTOS VALORES ANTES DE SUBIR EL CODIGO:
// 1. Nombre de tu red WiFi
// 2. Contraseña de tu red WiFi
// 3. Verifica que los pines del OLED sean correctos
// 4. Asegurate de tener todas las librerias instaladas

// Configuración OLED
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
#define SCREEN_ADDRESS 0x3C
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// Configuración WiFi - CAMBIA ESTOS VALORES
const char* ssid = "CASA";
const char* password = "2200220214";

// Configuración de pines
const int RELAY_PIN = 2;
const int LED_PIN = 5;
const int SDA_PIN = 21;
const int SCL_PIN = 22;

// Variables globales
WebServer server(80);
WiFiUDP ntpUDP;
NTPClient timeClient(ntpUDP, "pool.ntp.org", -18000, 60000);

struct Horario {
  int id;
  String nombre;
  int hora;
  int minuto;
  int duracion;
  bool activo;
};

Horario horarios[20];
int numHorarios = 0;
bool sistemaActivo = true;
unsigned long ultimoChequeo = 0;
unsigned long ultimaActualizacionOLED = 0;

void setup() {
  Serial.begin(115200);

  pinMode(RELAY_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, HIGH);
  digitalWrite(LED_PIN, LOW);

  Wire.begin(SDA_PIN, SCL_PIN);

  if(!display.begin(SSD1306_SWITCHCAPVCC, SCREEN_ADDRESS)) {
    Serial.println(F("Error: No se pudo inicializar OLED SSD1306"));
    for(;;);
  }

  mostrarPantallaInicio();

  EEPROM.begin(512);
  cargarConfiguracion();

  WiFi.begin(ssid, password);
  Serial.print("Conectando a WiFi");

  mostrarConectandoWiFi();

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println();
  Serial.print("Conectado! IP: ");
  Serial.println(WiFi.localIP());

  mostrarWiFiConectado();

  timeClient.begin();
  timeClient.update();

  server.on("/", handleRoot);
  server.on("/api/horarios", HTTP_GET, handleGetHorarios);
  server.on("/api/horarios", HTTP_POST, handleAddHorario);
  server.on("/api/horarios", HTTP_DELETE, handleDeleteHorario);
  server.on("/api/estado", HTTP_GET, handleGetEstado);
  server.on("/api/tiempo", HTTP_GET, handleGetTiempo);
  server.on("/api/toggle", HTTP_POST, handleToggleSystem);
  server.on("/api/timbre", HTTP_POST, handleManualBell);

  server.begin();
  Serial.println("Servidor web iniciado");

  digitalWrite(LED_PIN, HIGH);
  mostrarSistemaListo();
  delay(2000);
}

void loop() {
  server.handleClient();
  timeClient.update();

  if (millis() - ultimaActualizacionOLED > 1000) {
    actualizarPantallaOLED();
    ultimaActualizacionOLED = millis();
  }

  if (millis() - ultimoChequeo > 60000) {
    verificarHorarios();
    ultimoChequeo = millis();
  }

  delay(100);
}

// ========== FUNCIONES PARA OLED ==========

void mostrarPantallaInicio() {
  display.clearDisplay();
  display.setTextSize(2);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println(F("TIMBRE"));
  display.println(F("ESCOLAR"));
  display.setTextSize(1);
  display.setCursor(0, 40);
  display.println(F("Iniciando..."));
  display.setCursor(0, 55);
  display.println(F("v1.0 - 2025"));
  display.display();
}

void mostrarConectandoWiFi() {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println(F("CONECTANDO WIFI"));
  display.setCursor(0, 20);
  display.println(F("Red: "));
  display.println(ssid);
  display.setCursor(0, 50);
  display.println(F("Espere..."));
  display.display();
}

void mostrarWiFiConectado() {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println(F("WIFI CONECTADO"));
  display.setCursor(0, 20);
  display.println(F("IP: "));
  display.println(WiFi.localIP());
  display.setCursor(0, 50);
  display.println(F("Configurando..."));
  display.display();
}

void mostrarSistemaListo() {
  display.clearDisplay();
  display.setTextSize(2);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(10, 10);
  display.println(F("SISTEMA"));
  display.setCursor(25, 35);
  display.println(F("LISTO"));
  display.display();
}

void actualizarPantallaOLED() {
  display.clearDisplay();

  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println(F("TIMBRE ESCOLAR"));

  display.drawLine(0, 10, 127, 10, SSD1306_WHITE);

  display.setTextSize(2);
  display.setCursor(10, 15);
  display.println(timeClient.getFormattedTime());

  display.setTextSize(1);
  display.setCursor(0, 35);
  time_t rawtime = timeClient.getEpochTime();
  struct tm * timeinfo = localtime(&rawtime);
  display.print(timeinfo->tm_mday);
  display.print(F("/"));
  display.print(timeinfo->tm_mon + 1);
  display.print(F("/"));
  display.println(timeinfo->tm_year + 1900);

  display.setCursor(0, 45);
  if (sistemaActivo) {
    display.println(F("Estado: ACTIVO"));
  } else {
    display.println(F("Estado: INACTIVO"));
  }

  display.setCursor(0, 55);
  String proximoTimbre = obtenerProximoTimbre();
  if (proximoTimbre != "") {
    display.print(F("Prox: "));
    display.println(proximoTimbre);
  } else {
    display.println(F("Sin timbres"));
  }

  display.display();
}

void mostrarTimbreActivado(String nombre, int duracion) {
  display.clearDisplay();
  display.setTextSize(2);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(5, 5);
  display.println(F("TIMBRE"));
  display.setCursor(0, 25);
  display.println(F("ACTIVADO"));

  display.setTextSize(1);
  display.setCursor(0, 50);
  display.print(nombre);
  display.print(F(" - "));
  display.print(duracion);
  display.println(F("s"));

  display.display();
}

String obtenerProximoTimbre() {
  int horaActual = timeClient.getHours();
  int minutoActual = timeClient.getMinutes();
  int tiempoActual = horaActual * 60 + minutoActual;

  int proximoTiempo = -1;
  int proximoIndice = -1;

  for (int i = 0; i < numHorarios; i++) {
    if (horarios[i].activo) {
      int tiempoHorario = horarios[i].hora * 60 + horarios[i].minuto;
      if (tiempoHorario > tiempoActual) {
        if (proximoTiempo == -1 || tiempoHorario < proximoTiempo) {
          proximoTiempo = tiempoHorario;
          proximoIndice = i;
        }
      }
    }
  }

  if (proximoIndice != -1) {
    String tiempo = String(horarios[proximoIndice].hora < 10 ? "0" : "") + String(horarios[proximoIndice].hora) +
                   ":" + String(horarios[proximoIndice].minuto < 10 ? "0" : "") + String(horarios[proximoIndice].minuto);
    return tiempo;
  }

  return "";
}

// ========== FUNCIONES DEL SERVIDOR WEB ==========

void handleRoot() {
  String html = "<!DOCTYPE html><html><head><title>Sistema de Timbre Escolar</title>";
  html += "<meta charset='UTF-8'><meta name='viewport' content='width=device-width, initial-scale=1.0'>";
  html += "<link rel='preconnect' href='https://fonts.googleapis.com'>";
  html += "<link rel='preconnect' href='https://fonts.gstatic.com' crossorigin>";
  html += "<link href='https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap' rel='stylesheet'>";
  html += "<style>";
  html += "body{font-family:'Lato',sans-serif;margin:0;background-color:#f4f7fa;color:#333;}";
  html += ".container{max-width:900px;margin:30px auto;padding:10px;}";
  html += "h1{color:#2c3e50;text-align:center;margin-bottom:40px;font-weight:700;}";
  html += "h2{color:#34495e;border-bottom:2px solid #e0e0e0;padding-bottom:10px;margin-top:0;margin-bottom:20px;font-weight:700;}";
  html += ".section{margin-bottom:30px;padding:25px;background-color:#ffffff;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.08);}";
  html += ".form-group{margin-bottom:20px;}";
  html += "label{display:block;margin-bottom:8px;font-weight:700;color:#555;}";
  html += "input,select{width:100%;padding:12px;border:1px solid #ccc;border-radius:5px;box-sizing:border-box;background-color:#fdfdfd;font-family:'Lato',sans-serif;font-size:16px;}";
  html += "input:focus,select:focus{outline:none;border-color:#4a90e2;box-shadow:0 0 0 2px rgba(74,144,226,0.2);}";
  html += ".btn{padding:12px 25px;border:none;border-radius:5px;cursor:pointer;font-size:16px;font-weight:700;transition:background-color 0.3s ease;}";
  html += ".btn-primary{background-color:#4a90e2;color:white;}";
  html += ".btn-primary:hover{background-color:#357abd;}";
  html += ".btn-success{background-color:#2ecc71;color:white;}";
  html += ".btn-success:hover{background-color:#27ae60;}";
  html += ".btn-danger{background-color:#e74c3c;color:white;}";
  html += ".btn-danger:hover{background-color:#c0392b;}";
  html += ".btn-warning{background-color:#f39c12;color:white;}";
  html += ".btn-warning:hover{background-color:#e67e22;}";
  html += ".horario-item{display:flex;justify-content:space-between;align-items:center;background-color:#f9f9f9;padding:15px;margin-bottom:10px;border-radius:5px;border-left:4px solid #4a90e2;}";
  html += ".status{padding:12px;margin:10px 0;border-radius:5px;text-align:center;font-weight:700;}";
  html += ".status-active{background-color:#d4edda;color:#155724;}";
  html += ".status-inactive{background-color:#f8d7da;color:#721c24;}";
  html += ".oled-info{background-color:#eaf2f8;padding:15px;border-radius:8px;border-left:4px solid #3498db;}";

  // Dashboard Clock styles
  html += ".reloj-container{background-color:#ffffff;color:#333;padding:20px;border-radius:8px;text-align:center;margin:15px 0;}";
  html += ".reloj-hora{font-size:56px;font-weight:700;color:#2c3e50;margin-bottom:5px;}";
  html += ".reloj-fecha{font-size:18px;font-weight:400;color:#666;margin-bottom:10px;}";
  html += ".reloj-segundos{font-size:22px;font-weight:400;color:#4a90e2;}";
  html += "</style></head><body>";

  html += "<div class='container'>";
  html += "<h1>Sistema de Timbre Escolar</h1>";

  // Sección del reloj en tiempo real
  html += "<div class='section'>";
  html += "<h2>Reloj en Tiempo Real</h2>";
  html += "<div class='reloj-container'>";
  html += "<div class='reloj-hora' id='reloj-hora'>--:--</div>";
  html += "<div class='reloj-fecha' id='reloj-fecha'>Cargando fecha...</div>";
  html += "<div class='reloj-segundos' id='reloj-segundos'>--</div>";
  html += "</div>";
  html += "</div>";

  // Información OLED
  html += "<div class='section'>";
  html += "<h2>Estado de Pantalla OLED</h2>";
  html += "<div class='oled-info'>";
  html += "<p><strong>Pantalla:</strong> 0.9 OLED 128x64 - ACTIVA</p>";
  html += "<p><strong>I2C:</strong> SDA=GPIO21, SCL=GPIO22</p>";
  html += "<p><strong>Mostrando:</strong> Hora actual, fecha, estado del sistema y proximo timbre</p>";
  html += "<p><strong>Actualizacion:</strong> Cada segundo automaticamente</p>";
  html += "</div>";
  html += "</div>";

  // Resto del HTML...
  html += "<div class='section'>";
  html += "<h2>Agregar Nuevo Horario</h2>";
  html += "<form id='horarioForm'>";
  html += "<div class='form-group'>";
  html += "<label>Nombre del timbre:</label>";
  html += "<input type='text' id='nombre' placeholder='Ej: Recreo, Almuerzo, etc.' required>";
  html += "</div>";
  html += "<div class='form-group'>";
  html += "<label>Hora:</label>";
  html += "<input type='number' id='hora' min='0' max='23' required>";
  html += "</div>";
  html += "<div class='form-group'>";
  html += "<label>Minuto:</label>";
  html += "<input type='number' id='minuto' min='0' max='59' required>";
  html += "</div>";
  html += "<div class='form-group'>";
  html += "<label>Duracion (segundos):</label>";
  html += "<input type='number' id='duracion' min='1' max='60' value='5' required>";
  html += "</div>";
  html += "<button type='submit' class='btn btn-primary'>Agregar Horario</button>";
  html += "</form>";
  html += "</div>";

  html += "<div class='section'>";
  html += "<h2>Horarios Programados</h2>";
  html += "<div id='horarios'></div>";
  html += "</div>";

  html += "<div class='section'>";
  html += "<h2>Control del Sistema</h2>";
  html += "<div id='estado'></div>";
  html += "<button onclick='toggleSistema()' class='btn btn-warning'>Activar/Desactivar Sistema</button>";
  html += "<button onclick='activarTimbreManual()' class='btn btn-success'>Activar Timbre Manual</button>";
  html += "</div>";

  html += "</div>";

  // JavaScript
  html += "<script>";
  html += "let serverTime = { h: 0, m: 0, s: 0 };";
  html += "let lastSync = 0;";
  html += "let clockTimeout;";

  html += "function formatTime(h, m, s) {";
  html += "  const horas = h.toString().padStart(2,'0');";
  html += "  const minutos = m.toString().padStart(2,'0');";
  html += "  const segundos = s.toString().padStart(2,'0');";
  html += "  document.getElementById('reloj-hora').textContent = horas + ':' + minutos;";
  html += "  document.getElementById('reloj-segundos').textContent = segundos + ' seg';";
  html += "}";

  html += "function tick() {";
  html += "  serverTime.s++;";
  html += "  if (serverTime.s >= 60) { serverTime.s = 0; serverTime.m++; }";
  html += "  if (serverTime.m >= 60) { serverTime.m = 0; serverTime.h++; }";
  html += "  if (serverTime.h >= 24) { serverTime.h = 0; }";
  html += "  formatTime(serverTime.h, serverTime.m, serverTime.s);";
  html += "  const now = new Date().getTime();";
  html += "  if(now - lastSync > 30000) {"; // Resync every 30 seconds
  html += "     actualizarReloj();";
  html += "  } else {";
  html += "     clockTimeout = setTimeout(tick, 1000);";
  html += "  }";
  html += "}";

  html += "function actualizarReloj(){";
  html += "  clearTimeout(clockTimeout);";
  html += "  fetch('/api/tiempo').then(r=>r.json()).then(data=>{";
  html += "    serverTime = { h: data.h, m: data.m, s: data.s };";
  html += "    document.getElementById('reloj-fecha').textContent = data.fecha;";
  html += "    formatTime(serverTime.h, serverTime.m, serverTime.s);";
  html += "    lastSync = new Date().getTime();";
  html += "    clockTimeout = setTimeout(tick, 1000);";
  html += "  }).catch(e => {";
  html += "    console.error('Failed to fetch time', e);";
  html += "    clockTimeout = setTimeout(actualizarReloj, 5000);"; // Retry on failure
  html += "  });";
  html += "}";

  html += "function cargarDatos(){";
  html += "fetch('/api/horarios').then(r=>r.json()).then(data=>{";
  html += "let html='';";
  html += "data.forEach(h=>{";
  html += "html+=`<div class='horario-item'>`;";
  html += "html+=`<strong>${h.nombre}</strong> - ${h.hora.toString().padStart(2,'0')}:${h.minuto.toString().padStart(2,'0')} (${h.duracion}s)`;";
  html += "html+=` <button onclick='eliminarHorario(${h.id})' class='btn btn-danger' style='float:right'>Eliminar</button>`;";
  html += "html+=`</div>`;";
  html += "});";
  html += "document.getElementById('horarios').innerHTML=html;";
  html += "});";
  html += "fetch('/api/estado').then(r=>r.json()).then(data=>{";
  html += "let estadoClass = data.activo ? 'status-active' : 'status-inactive';";
  html += "let estadoTexto = data.activo ? 'ACTIVO' : 'INACTIVO';";
  html += "document.getElementById('estado').innerHTML=`<div class='status ${estadoClass}'>Sistema: ${estadoTexto}</div>`;";
  html += "});";
  html += "}";

  html += "document.getElementById('horarioForm').addEventListener('submit',function(e){";
  html += "e.preventDefault();";
  html += "let data={";
  html += "nombre:document.getElementById('nombre').value,";
  html += "hora:parseInt(document.getElementById('hora').value),";
  html += "minuto:parseInt(document.getElementById('minuto').value),";
  html += "duracion:parseInt(document.getElementById('duracion').value)";
  html += "};";
  html += "fetch('/api/horarios',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)})";
  html += ".then(()=>{cargarDatos();document.getElementById('horarioForm').reset();});";
  html += "});";

  html += "function eliminarHorario(id){";
  html += "fetch('/api/horarios?id='+id,{method:'DELETE'})";
  html += ".then(()=>cargarDatos());";
  html += "}";

  html += "function toggleSistema(){";
  html += "fetch('/api/toggle',{method:'POST'})";
  html += ".then(()=>cargarDatos());";
  html += "}";

  html += "function activarTimbreManual(){";
  html += "fetch('/api/timbre',{method:'POST'})";
  html += ".then(()=>alert('Timbre activado manualmente'));";
  html += "}";

  html += "cargarDatos();";
  html += "actualizarReloj();";
  html += "setInterval(cargarDatos, 5000);";
  html += "</script>";

  html += "</body></html>";

  server.send(200, "text/html", html);
}

// Resto de las funciones del servidor...
void handleGetHorarios() {
  JsonDocument doc;
  JsonArray array = doc.to<JsonArray>();

  for (int i = 0; i < numHorarios; i++) {
    JsonObject obj = array.add<JsonObject>();
    obj["id"] = horarios[i].id;
    obj["nombre"] = horarios[i].nombre;
    obj["hora"] = horarios[i].hora;
    obj["minuto"] = horarios[i].minuto;
    obj["duracion"] = horarios[i].duracion;
    obj["activo"] = horarios[i].activo;
  }

  String response;
  serializeJson(doc, response);
  server.send(200, "application/json", response);
}

void handleAddHorario() {
  if (numHorarios >= 20) {
    server.send(400, "text/plain", "Maximo 20 horarios");
    return;
  }

  JsonDocument doc;
  deserializeJson(doc, server.arg("plain"));

  horarios[numHorarios].id = numHorarios;
  horarios[numHorarios].nombre = doc["nombre"].as<String>();
  horarios[numHorarios].hora = doc["hora"];
  horarios[numHorarios].minuto = doc["minuto"];
  horarios[numHorarios].duracion = doc["duracion"];
  horarios[numHorarios].activo = true;

  numHorarios++;
  guardarConfiguracion();

  server.send(200, "text/plain", "Horario agregado");
}

void handleDeleteHorario() {
  int id = server.arg("id").toInt();

  for (int i = id; i < numHorarios - 1; i++) {
    horarios[i] = horarios[i + 1];
    horarios[i].id = i;
  }

  numHorarios--;
  guardarConfiguracion();

  server.send(200, "text/plain", "Horario eliminado");
}

void handleGetEstado() {
  JsonDocument doc;
  doc["activo"] = sistemaActivo;
  doc["numHorarios"] = numHorarios;

  String response;
  serializeJson(doc, response);
  server.send(200, "application/json", response);
}

void handleGetTiempo() {
  timeClient.update();

  JsonDocument doc;
  doc["hora"] = timeClient.getFormattedTime();
  doc["h"] = timeClient.getHours();
  doc["m"] = timeClient.getMinutes();
  doc["s"] = timeClient.getSeconds();

  time_t rawtime = timeClient.getEpochTime();
  struct tm * timeinfo = localtime(&rawtime);

  String dias[] = {"Domingo", "Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado"};
  String meses[] = {"Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
                   "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"};

  String fecha = dias[timeinfo->tm_wday] + ", " + String(timeinfo->tm_mday) +
                " de " + meses[timeinfo->tm_mon] + " de " + String(timeinfo->tm_year + 1900);
  doc["fecha"] = fecha;

  String response;
  serializeJson(doc, response);
  server.send(200, "application/json", response);
}

void handleToggleSystem() {
  sistemaActivo = !sistemaActivo;
  guardarConfiguracion();
  server.send(200, "text/plain", sistemaActivo ? "Sistema activado" : "Sistema desactivado");
}

void handleManualBell() {
  Serial.println("Timbre activado manually");
  mostrarTimbreActivado("Manual", 5);
  activarTimbre(5);
  server.send(200, "text/plain", "Timbre activado");
}

// ========== FUNCIONES DE SISTEMA ==========

void verificarHorarios() {
  if (!sistemaActivo) return;

  int horaActual = timeClient.getHours();
  int minutoActual = timeClient.getMinutes();

  for (int i = 0; i < numHorarios; i++) {
    if (horarios[i].activo &&
        horarios[i].hora == horaActual &&
        horarios[i].minuto == minutoActual) {

      Serial.println("Activando timbre: " + horarios[i].nombre);
      mostrarTimbreActivado(horarios[i].nombre, horarios[i].duracion);
      activarTimbre(horarios[i].duracion);
    }
  }
}

void activarTimbre(int duracion) {
  Serial.println("Timbre activado por " + String(duracion) + " segundos");

  digitalWrite(RELAY_PIN, LOW);
  digitalWrite(LED_PIN, LOW);

  delay(duracion * 1000);

  digitalWrite(RELAY_PIN, HIGH);
  digitalWrite(LED_PIN, HIGH);
}

void cargarConfiguracion() {
  EEPROM.get(0, sistemaActivo);
  EEPROM.get(4, numHorarios);

  if (numHorarios > 20) numHorarios = 0;

  for (int i = 0; i < numHorarios; i++) {
    int addr = 8 + (i * sizeof(Horario));
    EEPROM.get(addr, horarios[i]);
  }
}

void guardarConfiguracion() {
  EEPROM.put(0, sistemaActivo);
  EEPROM.put(4, numHorarios);

  for (int i = 0; i < numHorarios; i++) {
    int addr = 8 + (i * sizeof(Horario));
    EEPROM.put(addr, horarios[i]);
  }

  EEPROM.commit();
}

/*
========== FUNCIONES INCLUIDAS ==========
- Pantalla OLED completamente funcional
- Servidor web con interfaz completa
- Gestion de horarios
- Control manual del timbre
- Almacenamiento en EEPROM
- Sincronizacion de tiempo NTP
- Reloj en tiempo real en la interfaz web

CONFIGURACION IMPORTANTE:
1. Cambia ssid y password por los de tu red WiFi
2. Instala todas las librerias necesarias
3. Verifica las conexiones del OLED
4. Conecta el relay al pin 2 y LED al pin 5

Ahora el codigo deberia compilar sin errores!
*/
