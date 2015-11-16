# mxabierto mxabierto/buda-agent-jsonl
# https://github.com/mxabierto/buda/tree/master/agent/jsonl
# Build ( from parent directory ):
#   docker build -t mxabierto/buda-agent-jsonl -f jsonl/Dockerfile .
# Usage:
#   docker run \
#   --name XXXXX \
#   -dP mxabierto/buda-agent-jsonl

FROM mxabierto/nodejs

MAINTAINER bcessa <ben@pixative.com>

WORKDIR /root/buda-agent-jsonl

ADD . /root/buda-agent-jsonl

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
ENTRYPOINT ["jsonl/bin/buda-agent-jsonl"]
