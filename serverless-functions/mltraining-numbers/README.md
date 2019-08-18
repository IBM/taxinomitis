build
`docker build -t dalelane/mlforkids-numbers:0.1 .`

push
`docker push dalelane/mlforkids-numbers:0.1`

deploy
`ibmcloud fn deploy -m manifest.yaml`
