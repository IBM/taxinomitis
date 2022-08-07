FROM node:16

# don't run as root
USER node

# run the app in a folder owned by the node user
WORKDIR /usr/src/app

# install dependencies
COPY package*.json ./
RUN npm clean-install --omit=dev

# setup supporting files
RUN mkdir logs

RUN mkdir sql
COPY sql/*cert sql/.

COPY resources resources

# copy across build app
RUN mkdir web
COPY web/static web/static
COPY web/dynamic web/dynamic

RUN mkdir dist
COPY dist/lib dist/lib

CMD ["npm", "start"]
