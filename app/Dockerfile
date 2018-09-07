FROM jshimko/meteor-launchpad:latest

# fix fibers, see https://github.com/jshimko/meteor-launchpad/issues/92
RUN apt-get -y update && \
    apt-get -y install sudo curl vim net-tools && \
    curl -sL https://deb.nodesource.com/setup_8.x | sudo -E bash - && \
    sudo apt-get install -y nodejs && \
    cd /opt/meteor/dist/bundle/programs/server && npm uninstall fibers && npm install fibers
