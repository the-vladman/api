# mxabierto mxabierto/buda-agent-csv
# https://github.com/mxabierto/buda/tree/master/agent/csv
# Build ( from parent directory ):
#   docker build -t mxabierto/buda-agent-csv -f csv/Dockerfile .
# Usage:
#   docker run \
#   --name XXXXX \
#   -dP mxabierto/buda-agent-csv

FROM mxabierto/nodejs

MAINTAINER bcessa <ben@pixative.com>

WORKDIR /root/buda-agent-csv

ADD . /root/buda-agent-csv

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

# Default to running the start command
ENTRYPOINT ["csv/bin/buda-agent-csv"]
