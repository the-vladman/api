# mxabierto mxabierto/buda-agent-json
# https://github.com/mxabierto/buda/tree/master/agent/json
# Build ( from parent directory ):
#   docker build -t mxabierto/buda-agent-json -f json/Dockerfile .
# Usage:
#   docker run \
#   --name XXXXX \
#   -dP mxabierto/buda-agent-json

FROM mxabierto/nodejs

MAINTAINER bcessa <ben@pixative.com>

WORKDIR /root/buda-agent-json

ADD . /root/buda-agent-json

# Extra dependencies are required by node-gyp to build
# mongoose and ws =/
# but after modules compile are no longer required
RUN \
  apk-install g++ make python && \
  # Install base modules
  npm install --no-optional && \
  # Install agent-specific modules
  cd json && \
  npm install --no-optional && \
  # Cleanup
  apk del g++ make python

# Expose default connection port
EXPOSE 8200

# Default to running the start command
ENTRYPOINT ["json/bin/buda-agent-json"]
