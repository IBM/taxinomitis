FROM python:3.14.10-slim

RUN pip install --no-cache-dir --upgrade pip

RUN adduser --disabled-password --gecos "" mlforkids
USER mlforkids
WORKDIR /home/mlforkids

# the e5 weights are downloaded into the image while it is built,
#  so starting an instance never needs Hugging Face
ENV HF_HOME=/home/mlforkids/huggingface

# CPU-only torch first: the default Linux wheel on PyPI pulls in the
#  CUDA toolkit, which is several GB. requirements.txt's torch==2.15.0
#  is then already satisfied by 2.15.0+cpu.
RUN pip install --user --no-cache-dir torch==2.15.0+cpu --index-url https://download.pytorch.org/whl/cpu

COPY --chown=mlforkids:mlforkids requirements.txt requirements.txt
RUN pip install --user --no-cache-dir -r requirements.txt

COPY --chown=mlforkids:mlforkids app app
COPY --chown=mlforkids:mlforkids calibration calibration
COPY --chown=mlforkids:mlforkids scripts scripts
COPY --chown=mlforkids:mlforkids data/tatoeba-background.json data/tatoeba-background.json

# downloads e5 at the pinned revision, then makes background/tatoeba-e5.npz
#  (after checking the Tatoeba file's SHA-256 against the q1 curve)
RUN python -m scripts.make_background

ENV HF_HUB_OFFLINE=1

# Code Engine gives each instance 1 vCPU but shows it every host core, so
#  torch and BLAS would otherwise start a thread per host core and fight
#  over the one CPU. Override with --env if CPU in app.env changes.
ENV OMP_NUM_THREADS=1 OPENBLAS_NUM_THREADS=1 MKL_NUM_THREADS=1

CMD ["/home/mlforkids/.local/bin/uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
