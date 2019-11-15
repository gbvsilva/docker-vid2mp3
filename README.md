# docker-vid2mp3
Vid2MP3 web server image

Install Docker from https://docs.docker.com/install.

For example execute:

- `docker pull gbvsilva/vid2mp3`
- `docker run -dit -p 80:80 -p 443:443 --name vid2mp3 --restart always -v [path_to_host_folder]:/opt/vid2mp3 gbvsilva/vid2mp3`

The files already contained in the image:

- index.html
- server.js

