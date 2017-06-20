# mxabierto mxabierto/buda-front
# https://github.com/mxabierto/buda/tree/master/front
# Build:
#   docker build -t mxabierto/buda-front .
# Usage:
#   docker run \
#   --link buda-storage:storage \
#   --name buda-front \
#   -dP mxabierto/buda-front

FROM alpine

MAINTAINER bcessa <ben@pixative.com>

WORKDIR /root/buda-front

ADD . /root/buda-front

# Extra dependencies are required by node-gyp to build
# mongoose and ws =/
# but after modules compile are no longer required
RUN \
  apk --no-cache add nodejs g++ make python && \
  npm install -g npm@latest && \
  npm install --no-optional && \
  apk del g++ make python

# Expose default connection port
EXPOSE 8000

# Default to running the start command
ENTRYPOINT ["bin/buda-front"]
