#!/bin/sh
set -ex
rev=$(git rev-parse HEAD)
python twisted-depgraph.py twisted
# fix this if you need it to be more flexible (I don't care right now)
git clone -b gh-pages "https://${GH_TOKEN}@github.com/habnabit/twisted-depgraph"
mv *.json twisted-depgraph
cd twisted-depgraph
git config user.name "${GIT_NAME}"
git config user.email "${GIT_EMAIL}"
git add *.json
git commit -m "[travis-ci] Built from ${rev}."
git push origin master
