FROM python:3.9-slim-bullseye

WORKDIR /usr/src/app

RUN apt-get update && apt-get install -y graphviz

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY server.py ./
COPY training.py ./

CMD ["python", "server.py"]
