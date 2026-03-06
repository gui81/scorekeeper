# Meteor 3.1 bundles Node.js 22 — the runtime image must match
FROM node:22-slim AS build

RUN apt-get update && apt-get install -y curl python3 build-essential git && \
    rm -rf /var/lib/apt/lists/*

# Install Meteor 3
RUN curl https://install.meteor.com/ | sh
ENV PATH="/root/.meteor:${PATH}"

WORKDIR /app
COPY package.json .
RUN meteor npm install

COPY . .
RUN meteor build --directory /opt/build --server-only

WORKDIR /opt/build/bundle/programs/server
RUN npm install --production

# Production image
FROM node:22-slim

WORKDIR /opt/app
COPY --from=build /opt/build/bundle .

ENV PORT=3000
EXPOSE 3000

CMD ["node", "main.js"]
