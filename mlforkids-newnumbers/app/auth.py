# core dependencies
from os import environ
# external dependencies
from fastapi.security import HTTPBasicCredentials


username = environ["VERIFY_USER"]
password = environ["VERIFY_PASSWORD"]

# empty credentials would let in anyone who sends Basic auth of ":"
if username == "" or password == "":
    raise ValueError("VERIFY_USER and VERIFY_PASSWORD must not be empty")

def validate_password(creds: HTTPBasicCredentials):
    return creds.username == username and creds.password == password
