# mxabierto mxabierto/buda-agent-geojson
# https://github.com/mxabierto/buda/tree/master/agent/geojson
# Build ( from parent directory ):
#   docker build -t mxabierto/buda-agent-geojson -f geojson/Dockerfile .
# Usage:
#   docker run \
#   --name XXXXX \
#   -dP mxabierto/buda-agent-geojson

FROM mxabierto/nodejs

MAINTAINER bcessa <ben@pixative.com>

WORKDIR /root/buda-agent-geojson

ADD . /root/buda-agent-geojson

# Extra dependencies are required by node-gyp to build
# mongoose and ws =/
# but after modules compile are no longer required
RUN \
  apk-install g++ make python && \
  # Install base modules
  npm install --no-optional && \
  # Install agent-specific modules
  cd geojson && \
  npm install --no-optional && \
  # Cleanup
  apk del g++ make python

# Expose default connection port
EXPOSE 8200

# Default to running the start command
ENTRYPOINT ["geojson/bin/buda-agent-geojson"]
