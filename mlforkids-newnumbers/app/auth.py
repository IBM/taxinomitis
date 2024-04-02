# core dependencies
from os import environ
# external dependencies
from fastapi.security import HTTPBasicCredentials


username = environ["VERIFY_USER"]
password = environ["VERIFY_PASSWORD"]

def validate_password(creds: HTTPBasicCredentials):
    return creds.username == username and creds.password == password
