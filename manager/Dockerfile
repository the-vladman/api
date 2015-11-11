# mxabierto mxabierto/buda-manager
# https://github.com/mxabierto/buda/tree/master/manager
# Build:
#   docker build -t mxabierto/buda-manager .
# Usage:
#   docker run \
#   --link buda-storage:storage \
#   --name buda-manager \
#   -v /var/run/docker.sock:/var/run/docker.sock \
#   -dP mxabierto/buda-manager

FROM debian:jessie

MAINTAINER bcessa <ben@pixative.com>

WORKDIR /root/buda-manager

ADD . /root/buda-manager

# Install dependencies
RUN \
  apt-key adv --keyserver hkp://pgp.mit.edu:80 --recv-keys 58118E89F3A912897C070ADBF76221572C52609D && \
  echo "deb http://apt.dockerproject.org/repo debian-jessie main" >> /etc/apt/sources.list.d/docker.list && \
  apt-get update && \
  apt-get install -y \
    build-essential \
    docker-engine=1.7.1-0~jessie \
    python \
    wget && \
  # Install nodejs LTS
  wget "https://nodejs.org/dist/v4.2.2/node-v4.2.2-linux-x64.tar.gz" -O /opt/node-v4.2.2.tgz && \
  tar -xzf /opt/node-v4.2.2.tgz -C /opt && \
  rm /opt/node-v4.2.2.tgz && \
  ln -s /opt/node-v4.2.2-linux-x64/bin/node /bin/node && \
  ln -s /opt/node-v4.2.2-linux-x64/bin/npm /bin/npm && \
  npm install -g npm@latest && \
  # Install package modules
  npm install --no-optional && \
  # Clean up
  apt-get purge -y build-essential && \
  apt-get clean && \
  apt-get autoclean -y && \
  apt-get autoremove -y

# Expose default connection port
EXPOSE 8100

# Default to running the start command
ENTRYPOINT ["bin/buda-manager"]
