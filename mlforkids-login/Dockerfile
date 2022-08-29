FROM nginx:1.17

# using more recent versions of nginx images fail, as the auth0
#  address that we try to proxy_pass forward to is resolved to
#  an ipv6 address which fails
#
# I've tried a few approaches to disable ipv6, but nothing has
#  been successful, so resorting to using an old version as
#  described in https://github.com/nginxinc/docker-nginx/issues/374

COPY nginx.conf /etc/nginx/templates/nginx.conf.template
