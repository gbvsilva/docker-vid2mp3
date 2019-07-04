FROM node:10-alpine

# Create app directory
WORKDIR /opt/vid2mp3

COPY package*.json ./

RUN npm install

# Bundle app source
COPY . .

EXPOSE 80 443

CMD [ "node", "server.js" ]

