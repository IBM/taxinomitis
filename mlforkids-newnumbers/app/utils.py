# core dependencies
from logging import debug
from pathlib import Path
from os import walk
from os.path import basename, join
from datetime import datetime
from zipfile import ZipFile, ZIP_DEFLATED


def recursive_delete(location: Path):
    debug("recursive_delete %s", location)
    if location.exists() and location.is_dir():
        for path in location.iterdir():
            if path.is_file():
                path.unlink()
            else:
                recursive_delete(path)
        location.rmdir()


def create_zip_flat(source_folder, zip_filename):
    with ZipFile(zip_filename, 'w', ZIP_DEFLATED) as zipf:
        for root, _, files in walk(source_folder):
            for file in files:
                file_path = join(root, file)
                flat_path = basename(file_path)
                zipf.write(file_path, flat_path)

def json_serializer(obj):
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError ("Type %s not serializable" % type(obj))

