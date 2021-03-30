FROM node:8.2 AS build
MAINTAINER Peter Heisig <peter.heisig@tu-dresden.de>

ENV DEBIAN_FRONTEND noninteractive

################################################################################
#
#     Source processing
#
################################################################################

RUN mkdir -p /browser
COPY . /browser

################################################################################
#
#     Build frontend
#
################################################################################

RUN npm install -g yarn
WORKDIR /browser
RUN yarn 
RUN yarn build

################################################################################
#
#     Create server
#
################################################################################

FROM nginx:1.15-alpine AS deploy

COPY --from=build /browser/dist /usr/share/nginx/html

CMD ["nginx", "-g", "daemon off;"]


# NEO4J Dockerfile:

# FROM node:10-jessie

# WORKDIR /usr/src

# # Install dependencies
# COPY package.json yarn.lock ./
# RUN yarn

# # Copy the relevant files to the working directory
# COPY . .

# # Build and export the app
# RUN yarn build
# RUN cp -R dist /public
