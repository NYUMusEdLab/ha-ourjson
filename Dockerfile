FROM mhart/alpine-node:5.9
MAINTAINER Asyrique Thevendran <tech@musedlab.org>

COPY . /srv/app
WORKDIR /srv/app
RUN npm install
EXPOSE 8080
CMD ["npm", "start"]
