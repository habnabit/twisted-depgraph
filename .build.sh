#!/bin/sh
set -e
git clone -b gh-pages "https://${GH_TOKEN}@github.com/habnabit/twisted-depgraph"
set -x
git clone https://github.com/twisted/twisted
pip install -e twisted
depgraph_rev=$(git rev-parse HEAD)
twisted_rev=$(git -C twisted rev-parse HEAD)
python twisted-depgraph.py twisted
# fix this if you need it to be more flexible (I don't care right now)
mv *.json twisted-depgraph
cd twisted-depgraph
git config user.name "${GIT_NAME}"
git config user.email "${GIT_EMAIL}"
git add *.json
git commit -m "[travis-ci] Built from twisted ${twisted_rev}.

twisted-depgraph was ${depgraph_rev}."
git push origin gh-pages
