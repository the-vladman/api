#!/bin/sh
# Build all agents images
for agent in $(ls -d */); do
  docker build -t mxabierto/buda-agent-${agent%%/} -f ${agent%%/}/Dockerfile .
done
