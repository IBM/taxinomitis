# core dependencies
from logging import info, exception, basicConfig
from os import getenv
# external dependencies
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, BackgroundTasks
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from pandas import read_csv, unique

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
        #
        # every value in the file is a value that a child has chosen to use
        #  as a label, or as a choice in a multi-choice field, so we disable
        #  the default handling of missing values - otherwise labels like
        #  "None", "NA" or "null" would be turned into NaN
        #
        # empty values are the exception - they are used for fields that were
        #  added to a project after some training data had been collected, so
        #  they are the only values that really are missing
        df = read_csv(csvfile.file, keep_default_na=False, na_values=[""])
    except:
        exception("Failed to parse CSV for %s", scratch_key)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to process CSV file"
        )

    # check that the CSV contains the expected outcome column
    if "mlforkids_outcome_label" not in df.columns:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid CSV file"
        )

    # check that there are training examples for multiple classes
    #  otherwise model training will fail
    numclasses = len(unique(df["mlforkids_outcome_label"]))
    if numclasses < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Examples needed for at least two classes to train a model"
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
