# core dependencies
from logging import debug
from pathlib import Path
from os.path import relpath
from datetime import datetime
from zipfile import ZipFile, ZIP_DEFLATED


def recursive_delete(location: Path):
    debug('recursive_delete', location)
    if location.exists() and location.is_dir():
        for path in location.iterdir():
            if path.is_file():
                path.unlink()
            else:
                recursive_delete(path)
        location.rmdir()


def create_zip(files, source_folder, zip_filename):
    with ZipFile(zip_filename, 'w', ZIP_DEFLATED) as zipf:
        for file in files:
            rel_path = relpath(file, start=source_folder)
            zipf.write(file, rel_path)

def json_serializer(obj):
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError ("Type %s not serializable" % type(obj))

