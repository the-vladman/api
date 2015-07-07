# mxabierto mxabierto/buda-front
# https://github.com/mxabierto/buda/tree/master/front
# Build:
#   docker build -t mxabierto/buda-front .
# Usage:
#   docker run -dP mxabierto/buda-front

FROM mxabierto/nodejs

MAINTAINER bcessa <ben@pixative.com>

WORKDIR /root/buda-front

ADD . /root/buda-front

# Extra dependencies are required by node-gyp to build
# mongoose and ws =/
RUN \
  apk-install \
    g++ \
    make \
    python

# Install package modules
RUN npm install

# Expose default connection port
EXPOSE 8000

# Default to running the start command
ENTRYPOINT ["bin/buda-front"]
