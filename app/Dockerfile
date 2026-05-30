# Build on Red Hat's hardened (Project Hummingbird) Node.js images. The bundled Node 22
# matches the runtime Meteor 3.4 targets. The -builder variant adds bash/dnf/shadow-utils;
# the default runtime is distroless (no package manager) and runs as non-root UID 65532.
FROM registry.access.redhat.com/hi/nodejs:22-builder AS build

# Switch to root to add the build toolchain. The builder ships node, npm, curl and bash;
# we add tar/gzip/which for the Meteor installer and the C/C++ toolchain + python3 + git
# for native addons (e.g. bcrypt from accounts-password) compiled during the build.
USER root
RUN dnf -y install gcc gcc-c++ make python3 git gzip tar which && dnf clean all

# Install the Meteor 3 toolchain. Meteor refuses to run as root without this opt-in; HOME
# is set so the warehouse lands in /root/.meteor (the image default HOME is /tmp).
ENV HOME=/root
ENV METEOR_ALLOW_SUPERUSER=1
RUN curl https://install.meteor.com/ | sh
ENV PATH="/root/.meteor:${PATH}"

WORKDIR /app
COPY package.json .
RUN meteor npm install

COPY . .
RUN meteor build --directory /opt/build

WORKDIR /opt/build/bundle/programs/server
RUN npm install --omit=dev

# Production image — distroless, runs as non-root UID 65532 with HOME=/tmp.
FROM registry.access.redhat.com/hi/nodejs:22

WORKDIR /app
COPY --from=build --chown=65532:65532 /opt/build/bundle .

ENV PORT=3000
EXPOSE 3000

# Exec form (no /bin/sh in the distroless runtime). Node 22 provides global fetch.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://localhost:3000').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]

# The image entrypoint (docker-entrypoint.sh) execs this as `node main.js`.
CMD ["node", "main.js"]
