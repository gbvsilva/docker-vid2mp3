FROM alpine:3.7

RUN apk update
RUN apk add apache2
RUN apk add nodejs
RUN rm -rf /var/cache/apk/*

ARG htdir=/var/www/localhost/htdocs
RUN mkdir -p $htdir/vid2mp3
RUN mkdir -p /run/apache2

ADD index.html $htdir/vid2mp3/index.html
ADD httpd.conf /etc/apache2/httpd.conf 

EXPOSE 80 443 8080

WORKDIR $htdir/vid2mp3

CMD ["httpd", "-D", "FOREGROUND"]
CMD cd $htdir/vid2mp3
CMD node app.js

