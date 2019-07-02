#!/bin/sh
httpd -D FOREGROUND
cd /var/www/localhost/htdocs/vid2mp3
node scraper.js
