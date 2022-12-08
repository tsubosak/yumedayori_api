FROM node:16.18.1-bullseye-slim as builder

RUN mkdir /app
WORKDIR /app

COPY . .

RUN yarn install --production=false && yarn run build && yarn install --production=true

FROM node:16.18.1-bullseye-slim as release

LABEL fly_launch_runtime="nodejs"

COPY --from=builder --chown=node:node /app /app
USER node

WORKDIR /app
ENV NODE_ENV production
ARG COMMIT_SHA
ENV COMMIT_SHA=$COMMIT_SHA

EXPOSE 7000

CMD [ "yarn", "run", "start" ]
