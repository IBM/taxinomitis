# core dependencies
from logging import info
from os.path import isdir, join, exists
from os import environ, mkdir
from pathlib import Path
from datetime import datetime
from json import dump
# external dependencies
from cachetools import LRUCache
from fastapi import HTTPException, status
# local dependencies
from app.payloads import ModelInfo
from app.utils import recursive_delete, json_serializer


# initialising saved models folder
if not exists("saved-models"):
    info("Creating models folder")
    mkdir("saved-models")

# identifying direct URL for saved models
hostname = environ["PUBLIC_API_URL"]
info("Using root API %s", hostname)

# preparing models cache
cachesize = int(environ["MODELS_CACHE_SIZE"])
info("Preparing models cache for %d models", cachesize)
class cache_with_cleanup(LRUCache):
    def popitem(self):
        key, value = super().popitem()
        delete(key)
        return key, value
saved_models_cache = cache_with_cleanup(maxsize=cachesize)


# returns relative location of the model folder for a project
def get_location(scratchkey: str):
    return join("saved-models", scratchkey)


# Deletes files for a previous saved model
def delete(scratchkey: str):
    folder_location = get_location(scratchkey)
    folder = Path(folder_location)
    recursive_delete(folder)


# used when handling a request to train a new model
#  checks if there is already a model in-flight and throws
#   an exception if there is
def confirm_model_isnt_training(scratchkey: str):
    info("%s : Checking for existing model", scratchkey)

    if saved_models_cache.__contains__(scratchkey):
        info("%s : Model already known", scratchkey)
        saved_model = saved_models_cache[scratchkey]
        if saved_model["status"] == "Training":
            info("%s : Model training in progress. Rejecting request")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Model training in progress"
            )
        # otherwise, model is in a "ready" state, and we will
        #  replace it with a new model
        # or a previous attempt failed and is in an "error" state
    else:
        info("%s : Model not known", scratchkey)


# creates a folder where models can be saved
#  deletes any existing files/folders that are already there
def create_clean_folder(scratchkey: str):
    # identify folder where model will be saved
    models_folder_location = get_location(scratchkey)
    models_folder = Path(models_folder_location)

    # check if there is already a saved model for this project
    if isdir(models_folder):
        recursive_delete(models_folder)

    # create new folder and return
    mkdir(models_folder)
    return models_folder


# creates a new model record, and writes it to a file
#  returns the same info as a dict for returning to clients
def create_status_file(location: Path, scratchkey: str) -> ModelInfo:
    info("%s : Creating status object", scratchkey)
    scratchkeyurl = hostname + "/saved-models/" + scratchkey + "/"

    status = {
        "key": scratchkey,
        "status": "Training",
        "urls": {
            # json file with latest status
            "status": scratchkeyurl + "status",
            # location of the zip of model.save output
            "model": scratchkeyurl + "download/model.zip",
            # locations of visualisation output
            "tree": scratchkeyurl + "download/tree.svg",
            "dot": scratchkeyurl + "download/tree.dot",
            "vocab": scratchkeyurl + "download/vocab.json"
        },
        "lastupdate": datetime.now()
    }

    info("%s : Adding status object to cache", scratchkey)
    saved_models_cache[scratchkey] = status

    info("%s : Writing status to file", scratchkey)
    update_status_file(location, status)

    return status


# writes the new status for a model to a file that can be
#  used as a status API response
def update_status_file(model_folder: Path, info: ModelInfo):
    # if the model has been cleaned out, ignore
    if Path(model_folder).exists():
        # create status file
        with open(join(model_folder, "status"), "w") as statusfile:
            # write JSON payload to file
            dump(info, statusfile, default=json_serializer)


# Create a new saved model for the specified project
def create(scratchkey: str):
    # raise an exception if there is already a model training
    #  for this project
    confirm_model_isnt_training(scratchkey)
    # create a folder to store this model
    folder = create_clean_folder(scratchkey)
    # create a new status object to represent a new model
    return create_status_file(folder, scratchkey)


# delete working files from the model folder, leaving
#  only the tfjs model and the visualisation ready for
#  download
def cleanup(model_folder: str):
    model_folder_path = Path(model_folder)
    for path in model_folder_path.iterdir():
        if path.is_dir():
            if path.name != "download":
                recursive_delete(path)
        elif path.is_file() and path.name != "status":
            path.unlink()

