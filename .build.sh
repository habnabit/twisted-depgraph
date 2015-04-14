#!/bin/sh
set -e
# fix this if you need it to be more flexible (I don't care right now)
git clone -b gh-pages "https://${GH_TOKEN}@github.com/habnabit/twisted-depgraph"
set -x
git clone https://github.com/twisted/twisted
pip install -e 'twisted[all_non_platform]'
depgraph_rev=$(git rev-parse HEAD)
twisted_rev=$(git -C twisted rev-parse HEAD)
python twisted-depgraph.py twisted
mv *.json twisted-depgraph
cd twisted-depgraph
git config user.name "${GIT_NAME}"
git config user.email "${GIT_EMAIL}"
git add *.json
if git diff-index --quiet --cached HEAD; then
    echo 'nothing to commit'
    exit 0
fi
git commit -m "[travis-ci] Built from twisted ${twisted_rev}.

twisted-depgraph was ${depgraph_rev}."
git push -q origin gh-pages
