# core dependencies
from logging import info, exception, basicConfig
from os import getenv
# external dependencies
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, BackgroundTasks
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from pandas import read_csv

# debug logging
if getenv("MODE") == "development":
    basicConfig(filename="mlforkids.log", encoding="utf-8", level="INFO")
    print("Logging to file mlforkids.log")

# local dependencies
from app.savedmodels import create
from app.models import train_model
from app.auth import validate_password




# prepare API server
info("Preparing API server")
app = FastAPI(openapi_url=None)
security = HTTPBasic()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://machinelearningforkids.co.uk"
    ]
)

# healthcheck endpoint for use by kubernetes probes
@app.get("/")
def healthcheck():
    return { "ok" : True }


# hosting created decision tree models as static files
app.mount("/saved-models", StaticFiles(directory="saved-models"), name="static")


# handle requests to train new models
@app.post("/model-requests/{scratch_key}")
async def model_training_request(scratch_key: str, csvfile: UploadFile,
                                 background_tasks: BackgroundTasks,
                                 credentials: HTTPBasicCredentials = Depends(security)):

    # check credentials before proceeding
    if not validate_password(credentials):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Basic"},
        )

    # credentials okay - check we have been given a
    #  usable CSV file before letting the user think
    #  that training will be attempted
    info("%s : New training request", scratch_key)
    try:
        # read the CSV file into a pandas dataframe
        df = read_csv(csvfile.file)
    except:
        exception("Failed to parse CSV for %s", scratch_key)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to process CSV file"
        )

    # record placeholder status file to record training
    info("%s : Creating model folder", scratch_key)
    savedmodel = create(scratch_key)

    # start training the model in a background thread
    info("%s : Starting model thread", scratch_key)
    background_tasks.add_task(train_model, savedmodel, df)

    # return the placeholder status to the client
    info("%s : Returning status", scratch_key)
    return savedmodel
