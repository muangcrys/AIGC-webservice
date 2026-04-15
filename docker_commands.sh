#!/bin/bash

# compose docker image
docker buildx build --platform=linux/amd64,linux/arm64 -t webservice-frontend --load .

# save to tar file
docker image save webservice-frontend -o webservice_frontend.tar

# run command
docker run -d --name webservice-frontend \
  --network aigc_network \
  --publish 80:80 \
  webservice-frontend

