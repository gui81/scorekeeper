FROM node:20-slim

RUN apt-get update && apt-get install -y curl python3 build-essential git && \
    rm -rf /var/lib/apt/lists/*

# Install Meteor 3
RUN curl https://install.meteor.com/ | sh

WORKDIR /app
COPY . .

RUN meteor npm install --production
RUN meteor build --directory /opt/build

WORKDIR /opt/build/bundle/programs/server
RUN npm install

WORKDIR /opt/build/bundle

ENV PORT=3000
EXPOSE 3000

CMD ["node", "main.js"]
