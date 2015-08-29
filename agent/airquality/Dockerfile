# mxabierto mxabierto/buda-agent-airquality
# https://github.com/mxabierto/buda/tree/master/agent/airquality
# Build ( from parent directory ):
#   docker build -t mxabierto/buda-agent-airquality -f airquality/Dockerfile .
# Usage:
#   docker run \
#   --name XXXXX \
#   -dP mxabierto/buda-agent-airquality

FROM mxabierto/nodejs

MAINTAINER bcessa <ben@pixative.com>

WORKDIR /root/buda-agent-airquality

ADD . /root/buda-agent-airquality

# Extra dependencies are required by node-gyp to build
# mongoose and ws =/
# but after modules compile are no longer required
RUN \
  apk-install g++ make python && \
  # Install base modules
  npm install && \
  # Install agent-specific modules
  cd csv && \
  npm install && \
  # Cleanup
  apk del g++ make python

# Expose default connection port
EXPOSE 8200

# Default to running the start command
ENTRYPOINT ["airquality/bin/airquality"]
