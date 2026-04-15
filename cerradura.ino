#include <Keypad.h>
#include <LiquidCrystal_I2C.h>
#include <EEPROM.h>
#include <Wire.h>

// Configuración del Teclado 4x4
const byte FILAS = 4;
const byte COLUMNAS = 4;
char teclas[FILAS][COLUMNAS] = {
  {'1','2','3','A'},
  {'4','5','6','B'},
  {'7','8','9','C'},
  {'*','0','#','D'}
};
byte pinesFilas[FILAS] = {9, 8, 7, 6};    // Pines para las filas
byte pinesColumnas[COLUMNAS] = {5, 4, 3, 2}; // Pines para las columnas
Keypad teclado = Keypad(makeKeymap(teclas), pinesFilas, pinesColumnas, FILAS, COLUMNAS);

// Configuración del LCD I2C (Dirección 0x27 o 0x3F comúnmente)
LiquidCrystal_I2C lcd(0x27, 16, 2);

// Configuración de Pines de Salida
const int PIN_RELE = 10;
const int PIN_BUZZER = 11;

// Variables Globales
char claveMaestra[7]; // Clave de 6 dígitos máximo + nulo
char claveIngresada[7];
byte indiceClave = 0;
bool cambiandoClave = false;

// Dirección en EEPROM para guardar la clave
const int ADDR_CLAVE = 0;
const int ADDR_CONFIG = 10; // Para saber si ya se grabó una clave antes

void setup() {
  pinMode(PIN_RELE, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  digitalWrite(PIN_RELE, LOW); // Cerradura bloqueada (si es Normalmente Abierto)

  lcd.init();
  lcd.backlight();

  Serial.begin(9600);

  // Verificar si ya existe una clave grabada
  if (EEPROM.read(ADDR_CONFIG) != 123) {
    // Si es la primera vez, grabamos una clave por defecto "1234"
    strcpy(claveMaestra, "1234");
    guardarClaveEEPROM("1234");
    EEPROM.write(ADDR_CONFIG, 123);
  } else {
    // Cargar la clave desde EEPROM
    leerClaveEEPROM();
  }

  mostrarPantallaInicio();
}

void loop() {
  char tecla = teclado.getKey();

  if (tecla) {
    tone(PIN_BUZZER, 2000, 100); // Feedback sonoro al presionar

    if (cambiandoClave) {
      gestionarCambioClave(tecla);
    } else {
      if (tecla == '*') {
        // Iniciar proceso de cambio de clave
        prepararCambioClave();
      } else if (tecla == '#') {
        // Verificar clave al presionar '#'
        verificarClave();
      } else if (tecla == 'C' || tecla == 'D') {
        // Opción para borrar lo ingresado
        mostrarPantallaInicio();
      } else {
        // Ir guardando los dígitos (solo números y A, B)
        if (indiceClave < 6) {
          claveIngresada[indiceClave] = tecla;
          indiceClave++;
          claveIngresada[indiceClave] = '\0';

          lcd.setCursor(indiceClave - 1, 1);
          lcd.print('*');
        }
      }
    }
  }
}

void mostrarPantallaInicio() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("INTRODUZCA CLAVE");
  lcd.setCursor(0, 1);
  indiceClave = 0;
  memset(claveIngresada, 0, sizeof(claveIngresada));
}

void verificarClave() {
  if (strcmp(claveIngresada, claveMaestra) == 0) {
    accesoConcedido();
  } else {
    accesoDenegado();
  }
  mostrarPantallaInicio();
}

void accesoConcedido() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("CLAVE CORRECTA");
  lcd.setCursor(0, 1);
  lcd.print("BIENVENIDO");

  digitalWrite(PIN_RELE, HIGH); // Activar cerradura
  tone(PIN_BUZZER, 1000, 500);
  delay(3000); // Mantener abierto 3 segundos
  digitalWrite(PIN_RELE, LOW);
}

void accesoDenegado() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("CLAVE INCORRECTA");
  tone(PIN_BUZZER, 500, 1000);
  delay(2000);
}

void prepararCambioClave() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("CLAVE ACTUAL:");
  indiceClave = 0;
  memset(claveIngresada, 0, sizeof(claveIngresada));

  // Primero verificamos la clave actual antes de dejar cambiarla
  while (true) {
    char t = teclado.getKey();
    if (t) {
      tone(PIN_BUZZER, 2000, 100);
      if (t == '#') {
        if (strcmp(claveIngresada, claveMaestra) == 0) {
          cambiandoClave = true;
          lcd.clear();
          lcd.setCursor(0, 0);
          lcd.print("NUEVA CLAVE:");
          indiceClave = 0;
          memset(claveIngresada, 0, sizeof(claveIngresada));
          return;
        } else {
          accesoDenegado();
          mostrarPantallaInicio();
          return;
        }
      } else if (t == '*') { // Cancelar con *
        mostrarPantallaInicio();
        return;
      } else if (indiceClave < 6) {
        claveIngresada[indiceClave] = t;
        indiceClave++;
        claveIngresada[indiceClave] = '\0';
        lcd.setCursor(indiceClave - 1, 1);
        lcd.print('*');
      }
    }
  }
}

void gestionarCambioClave(char tecla) {
  if (tecla == '#') {
    if (indiceClave >= 4) { // Clave de al menos 4 dígitos
      guardarClaveEEPROM(claveIngresada);
      strcpy(claveMaestra, claveIngresada);
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("CLAVE CAMBIADA");
      lcd.setCursor(0, 1);
      lcd.print("CON EXITO");
      delay(2000);
      cambiandoClave = false;
      mostrarPantallaInicio();
    } else {
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("MIN. 4 DIGITOS");
      delay(2000);
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("NUEVA CLAVE:");
      indiceClave = 0;
      memset(claveIngresada, 0, sizeof(claveIngresada));
    }
  } else if (indiceClave < 6) {
    claveIngresada[indiceClave] = tecla;
    indiceClave++;
    claveIngresada[indiceClave] = '\0';
    lcd.setCursor(indiceClave - 1, 1);
    lcd.print(tecla); // Mostramos el número mientras la escribe para seguridad visual
  }
}

void guardarClaveEEPROM(const char* clave) {
  for (int i = 0; i < 6; i++) {
    EEPROM.update(ADDR_CLAVE + i, clave[i]);
    if (clave[i] == '\0') break;
  }
}

void leerClaveEEPROM() {
  for (int i = 0; i < 6; i++) {
    claveMaestra[i] = EEPROM.read(ADDR_CLAVE + i);
    if (claveMaestra[i] == '\0' || (byte)claveMaestra[i] == 255) {
      claveMaestra[i] = '\0';
      break;
    }
  }
  claveMaestra[6] = '\0';
}
