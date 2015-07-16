# mxabierto mxabierto/buda-agent-xml
# https://github.com/mxabierto/buda/tree/master/agent/xml
# Build ( from parent directory ):
#   docker build -t mxabierto/buda-agent-xml -f xml/Dockerfile .
# Usage:
#   docker run \
#   --name XXXXX \
#   -dP mxabierto/buda-agent-xml

FROM mxabierto/nodejs

MAINTAINER bcessa <ben@pixative.com>

WORKDIR /root/buda-agent-xml

ADD . /root/buda-agent-xml

# Extra dependencies are required by node-gyp to build
# mongoose and ws =/
# but after modules compile are no longer required
RUN \
  apk-install g++ make python && \
  # Install base modules
  npm install && \
  # Install agent-specific modules
  cd xml && \
  npm install && \
  # Cleanup
  apk del g++ make python

# Expose default connection port
EXPOSE 8200

# Default to running the start command
ENTRYPOINT ["xml/bin/buda-agent-xml"]
