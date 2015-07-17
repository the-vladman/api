# mxabierto mxabierto/buda-manager
# https://github.com/mxabierto/buda/tree/master/manager
# Build:
#   docker build -t mxabierto/buda-manager .
# Usage:
#   docker run \
#   --name buda-manager \
#   -v /var/run/docker.sock:/var/run/docker.sock \
#   -dP mxabierto/buda-manager

FROM debian

MAINTAINER bcessa <ben@pixative.com>

WORKDIR /root/buda-manager

ADD . /root/buda-manager

# Install dependencies
RUN \
  apt-get update && \
  apt-get install -y \
    curl && \
  echo "deb http://httpredir.debian.org/debian jessie-backports main" >> /etc/apt/sources.list && \
  curl -sL https://deb.nodesource.com/setup_0.12 | bash - && \
  apt-get install -y \
    build-essential \
    docker.io \
    nodejs && \
  # Install package modules
  npm install && \
  # Clean up
  apt-get purge -y build-essential && \
  apt-get clean && \
  apt-get autoclean -y && \
  apt-get autoremove -y

# Expose default connection port
EXPOSE 8100

# Default to running the start command
ENTRYPOINT ["bin/buda-manager"]
