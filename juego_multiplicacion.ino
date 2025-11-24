#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <Keypad.h>

// --- CONFIGURACIÓN DE LA PANTALLA LCD ---
// Establece la dirección I2C de tu pantalla LCD. Las más comunes son 0x27 y 0x3F.
// Si el código no funciona, es posible que necesites un "I2C Scanner" para encontrar la dirección correcta.
LiquidCrystal_I2C lcd(0x27, 16, 2);

// --- CONFIGURACIÓN DEL TECLADO 4x4 ---
const byte ROWS = 4; // 4 filas
const byte COLS = 4; // 4 columnas

// Define el mapa de caracteres del teclado.
char keys[ROWS][COLS] = {
  {'1','2','3','A'},
  {'4','5','6','B'},
  {'7','8','9','C'},
  {'*','0','#','D'}
};

// Define los pines de Arduino que se conectan a las filas y columnas del teclado.
// Asegúrate de que estos pines coincidan con tu conexión física.
byte rowPins[ROWS] = {9, 8, 7, 6}; // Pines para R1, R2, R3, R4
byte colPins[COLS] = {5, 4, 3, 2}; // Pines para C1, C2, C3, C4

// Crea una instancia de la librería Keypad.
Keypad keypad = Keypad(makeKeymap(keys), rowPins, colPins, ROWS, COLS);

// --- VARIABLES DEL JUEGO ---
int num1, num2;
int respuestaCorrecta;
String respuestaUsuario = ""; // Almacena la respuesta introducida por el usuario.

void setup() {
  // Inicializa la pantalla LCD.
  lcd.init();
  lcd.backlight();

  // Muestra un mensaje de bienvenida.
  lcd.setCursor(0, 0);
  lcd.print("Juego de Multiplicar");
  delay(2000);

  // Inicializa el generador de números aleatorios usando un pin analógico no conectado.
  randomSeed(analogRead(A0));

  // Inicia la primera pregunta.
  nuevaPregunta();
}

void loop() {
  // Obtiene la tecla presionada en el teclado.
  char key = keypad.getKey();

  // Si se ha presionado una tecla, procesa la entrada.
  if (key) {
    // La tecla '#' se usa para enviar la respuesta.
    if (key == '#') {
      // Solo procesa la respuesta si el usuario ha introducido algo.
      if (respuestaUsuario.length() > 0) {
        verificarRespuesta();
      }
    }
    // La tecla '*' se usa para borrar la respuesta actual.
    else if (key == '*') {
      respuestaUsuario = "";
      lcd.setCursor(0, 1);
      lcd.print("                "); // Borra la segunda línea del LCD.
      lcd.setCursor(0, 1); // Reposiciona el cursor.
    }
    // Si la tecla es un dígito, se añade a la respuesta.
    else if (isDigit(key)) {
      respuestaUsuario += key;
      lcd.setCursor(0, 1);
      lcd.print(respuestaUsuario);
    }
  }
}

// --- FUNCIONES DEL JUEGO ---

void nuevaPregunta() {
  // Limpia la respuesta anterior.
  respuestaUsuario = "";

  // Genera dos números aleatorios de un dígito (del 1 al 9).
  num1 = random(1, 10);
  num2 = random(1, 10);

  // Calcula la respuesta correcta.
  respuestaCorrecta = num1 * num2;

  // Muestra la nueva pregunta en el LCD.
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print(num1);
  lcd.print(" x ");
  lcd.print(num2);
  lcd.print(" = ?");

  // Coloca el cursor en la segunda línea para la respuesta.
  lcd.setCursor(0, 1);
}

void verificarRespuesta() {
  lcd.clear();
  lcd.setCursor(0, 0);

  // Compara la respuesta del usuario (convertida a número) con la respuesta correcta.
  if (respuestaUsuario.toInt() == respuestaCorrecta) {
    lcd.print("¡Correcto!");
  } else {
    lcd.print("Incorrecto...");
    lcd.setCursor(0, 1);
    lcd.print("Era: ");
    lcd.print(respuestaCorrecta);
  }

  // Espera 3 segundos antes de mostrar la siguiente pregunta.
  delay(3000);

  // Genera una nueva pregunta.
  nuevaPregunta();
}
