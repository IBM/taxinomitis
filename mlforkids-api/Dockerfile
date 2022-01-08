FROM node:16

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm clean-install --only=production

RUN mkdir logs

RUN mkdir sql
COPY sql/*cert sql/.

COPY resources resources

RUN mkdir web
COPY web/static web/static
COPY web/dynamic web/dynamic

RUN mkdir dist
COPY dist/lib dist/lib

CMD ["npm", "start"]
