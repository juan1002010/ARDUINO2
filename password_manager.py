# password_manager.py
import secrets
import string
import argparse
import json
import os
import getpass
import base64
from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.scrypt import Scrypt
from cryptography.hazmat.backends import default_backend

PASSWORDS_FILE = "passwords.json"
SALT_FILE = "salt.bin" # Sal para la derivación de la clave

def derive_key(password: str, salt: bytes) -> bytes:
    """Deriva una clave de cifrado a partir de una contraseña y una sal."""
    kdf = Scrypt(
        salt=salt,
        length=32,
        n=2**14,
        r=8,
        p=1,
        backend=default_backend()
    )
    key = kdf.derive(password.encode())
    return base64.urlsafe_b64encode(key)

def generate_password(length, use_uppercase, use_lowercase, use_numbers, use_symbols):
    """Genera una contraseña segura y aleatoria."""
    characters = ''
    if use_uppercase: characters += string.ascii_uppercase
    if use_lowercase: characters += string.ascii_lowercase
    if use_numbers: characters += string.digits
    if use_symbols: characters += string.punctuation
    if not characters:
        raise ValueError("Debes seleccionar al menos un tipo de caracter.")
    return ''.join(secrets.choice(characters) for _ in range(length))

def get_master_password():
    """Solicita la contraseña maestra de forma segura."""
    return getpass.getpass("Introduce la contraseña maestra: ")

def load_passwords(master_password):
    """Carga y descifra las contraseñas desde el archivo JSON."""
    if not os.path.exists(PASSWORDS_FILE):
        return {}

    if not os.path.exists(SALT_FILE):
        print("Error: No se encuentra el archivo de sal. El almacén de contraseñas puede estar corrupto.")
        exit()

    with open(SALT_FILE, 'rb') as f:
        salt = f.read()

    key = derive_key(master_password, salt)
    f = Fernet(key)

    with open(PASSWORDS_FILE, 'rb') as file:
        encrypted_data = file.read()

    try:
        decrypted_data = f.decrypt(encrypted_data)
        return json.loads(decrypted_data.decode())
    except InvalidToken:
        print("Contraseña maestra incorrecta o archivo corrupto.")
        exit()

def save_passwords(passwords, master_password):
    """Cifra y guarda las contraseñas en el archivo JSON."""
    if not os.path.exists(SALT_FILE):
        salt = os.urandom(16)
        with open(SALT_FILE, 'wb') as f:
            f.write(salt)
    else:
        with open(SALT_FILE, 'rb') as f:
            salt = f.read()

    key = derive_key(master_password, salt)
    f = Fernet(key)

    encrypted_data = f.encrypt(json.dumps(passwords).encode())
    with open(PASSWORDS_FILE, 'wb') as file:
        file.write(encrypted_data)

def main():
    parser = argparse.ArgumentParser(description="Un gestor de contraseñas de línea de comandos seguro.")
    subparsers = parser.add_subparsers(dest="command", help="Comandos disponibles", required=True)

    gen_parser = subparsers.add_parser("generate", help="Generar una nueva contraseña")
    gen_parser.add_argument("-l", "--length", type=int, default=16)
    gen_parser.add_argument("--no-uppercase", action="store_false", dest="uppercase")
    gen_parser.add_argument("--no-lowercase", action="store_false", dest="lowercase")
    gen_parser.add_argument("--no-numbers", action="store_false", dest="numbers")
    gen_parser.add_argument("--no-symbols", action="store_false", dest="symbols")

    save_parser = subparsers.add_parser("save", help="Guardar una nueva contraseña")
    save_parser.add_argument("service", help="El nombre del servicio")
    save_parser.add_argument("username", help="El nombre de usuario")

    get_parser = subparsers.add_parser("get", help="Obtener una contraseña")
    get_parser.add_argument("service", help="El nombre del servicio")

    subparsers.add_parser("list", help="Listar todos los servicios")

    args = parser.parse_args()

    if args.command == "generate":
        pw = generate_password(args.length, args.uppercase, args.lowercase, args.numbers, args.symbols)
        print(f"Contraseña generada: {pw}")
        return

    master_password = get_master_password()
    passwords = load_passwords(master_password)

    if args.command == "save":
        password_to_save = getpass.getpass(f"Introduce la contraseña para '{args.service}': ")
        passwords[args.service] = {"username": args.username, "password": password_to_save}
        save_passwords(passwords, master_password)
        print(f"Contraseña para '{args.service}' guardada de forma segura.")

    elif args.command == "get":
        entry = passwords.get(args.service)
        if entry:
            print(f"Servicio: {args.service}\n  Usuario: {entry['username']}\n  Contraseña: {entry['password']}")
        else:
            print(f"No se encontró el servicio '{args.service}'.")

    elif args.command == "list":
        if passwords:
            print("Servicios guardados:")
            for service in passwords:
                print(f"- {service}")
        else:
            print("No hay contraseñas guardadas.")

if __name__ == "__main__":
    main()
