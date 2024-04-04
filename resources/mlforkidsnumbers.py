from urllib.request import urlopen
from urllib.error import HTTPError
from urllib.parse import urlparse, urljoin, unquote
from requests import get
from os import makedirs, remove
from os.path import join, exists
from shutil import rmtree
from json import load, loads
from zipfile import ZipFile
from pandas import DataFrame
import tensorflow_decision_forests as tfdf
from tf_keras.models import load_model



class MLforKidsNumbers:
    def __init__(self, url):
        self._message("Checking for downloaded model...")
        key = self._get_model_key(url)
        model_folder = self._get_saved_model_folder(key)
        if exists(model_folder):
            self._message("Reusing downloaded model from " + model_folder)
        else:
            self._download_model(url, model_folder)

        self._message("Loading model...")
        self.MODEL = load_model(model_folder)

        self._message("Accessing model metadata...")
        self.METADATA = self._read_json_file(join(model_folder, "mlforkids.json"))
        self._message("Model trained at " + self.METADATA["lastupdate"])


    # ------------------------------------------------------------
    #  Helper functions to display output
    # ------------------------------------------------------------

    def _message(self, str):
        print("\033[1m MLforKids : " + str + " \033[0m")

    def _debug(self, str):
        print("-----------------------------------------------------")
        print(str)
        print("-----------------------------------------------------")


    # ------------------------------------------------------------
    #  Get the key from a model URL
    # ------------------------------------------------------------

    def _get_model_key(self, url):
        parsed_url = urlparse(url)
        path_segments = parsed_url.path.split('/')
        if len(path_segments) > 2:
            return unquote(path_segments[2])
        raise Exception("Unrecognised URL")


    # ------------------------------------------------------------
    #  Identify the location where project files will be saved
    # ------------------------------------------------------------

    def _get_saved_model_folder(self, key):
        folder = join("saved_models", key)
        return folder


    # ------------------------------------------------------------
    #  Helper function to read a JSON file
    # ------------------------------------------------------------

    def _read_json_file(self, location):
        with open(location, 'r') as file:
            return loads(file.read())


    # ------------------------------------------------------------
    #  Helper function to download a file to disk
    # ------------------------------------------------------------

    def _download_file(self, url, target):
        headers = {'User-Agent': 'MachineLearningForKids-Python'}
        response = get(url, headers=headers)
        if response.status_code == 200:
            with open(target, 'wb') as file:
                file.write(response.content)
        else:
            raise Exception("Failed to download file from {url}")


    # ------------------------------------------------------------
    #  Get URL location of zip file on model server
    # ------------------------------------------------------------

    def _get_model_info(self, status_url):
        try:
            with urlopen(status_url) as url:
                project_info = load(url)

                if project_info["status"] != "Available":
                    self._debug(project_info)
                    raise Exception ("The model is not available for use - the current status is " + project_info["status"])

                return project_info

        except HTTPError as e:
            if e.code == 404:
                self._message("The model is no longer available on the model server.")
                self._message("Models are only stored online for a short time. ")
                self._message("Train a new model on the Machine Learning for Kids site, then try again with the new URL.")
                raise Exception ("Model unavailable")
            else:
                raise e


    # ------------------------------------------------------------
    #  Download the model zip from the model server and unpack
    # ------------------------------------------------------------

    def _download_model(self, status_url, model_folder):
        self._message("Getting model info...")
        model_info = self._get_model_info(status_url)

        self._message("Preparing for download...")
        if exists(model_folder):
            rmtree(model_folder)
        makedirs(model_folder)

        self._message("Downloading model...")
        model_zip = join(model_folder, "python.zip")
        self._download_file(
            urljoin(model_info["urls"]["model"], "python.zip"),
            model_zip)
        self._download_file(
            status_url,
            join(model_folder, "mlforkids.json"))

        self._message("Unpacking model...")
        with ZipFile(model_zip, 'r') as zip_ref:
            zip_ref.extractall(model_folder)
        remove(model_zip)



    def _sort_by_confidence (self, e):
        return e["confidence"]


    # use the model to classify the provided data
    #  returns a sorted list of objects, one for each label
    #  each with a confidence percentage
    def classify(self, data):
        labelled = {}
        types = {}
        for feature in self.METADATA["features"]:
            label = self.METADATA["features"][feature]["name"]
            type = self.METADATA["features"][feature]["type"]
            if label == "mlforkids_outcome_label":
                continue
            if not feature in data:
                raise Exception("Missing required value " + feature)
            labelled[label] = data[feature]
            if type != "object":
                types[label] = type
        df = DataFrame([ labelled ])
        ds = tfdf.keras.pd_dataframe_to_tf_dataset(df.astype(types), label=None)
        classifications = self.MODEL.predict(ds)
        results = []
        if len(self.METADATA["labels"]) == 2:
            results.append({
                "class_name" : self.METADATA["labels"][0],
                "confidence" : int((1 - classifications[0].item()) * 100)
            })
            results.append({
                "class_name" : self.METADATA["labels"][1],
                "confidence" : int((classifications[0].item()) * 100)
            })
        else:
            idx = 0
            for classification in classifications[0]:
                results.append({
                    "class_name": self.METADATA["labels"][idx],
                    "confidence": int(classification.item() * 100)
                })
                idx += 1

        results.sort(reverse=True, key=self._sort_by_confidence)
        return results

