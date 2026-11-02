#!/bin/bash
# The CI copies the build job's artifacts into artifacts/ before this script runs; a local run takes the
# jar `mvn clean install` left in ../menu-manager/target and the package of ../menu-manager-views/dist.
# @jahia/cypress installs every *-SNAPSHOT.jar, then every *-SNAPSHOT.tgz, then builds the tests image.
mkdir -p ./artifacts
for file in ../menu-manager/target/*-SNAPSHOT.jar; do
  if [[ -e "$file" && "$file" != *-sources.jar ]]; then
    cp "$file" ./artifacts/
  fi
done
if [[ -e ../menu-manager-views/dist/package.tgz ]]; then
  version=$(node -p "require('../menu-manager-views/package.json').version")
  cp ../menu-manager-views/dist/package.tgz "./artifacts/menu-manager-views-${version}.tgz"
fi

version=$(node -p "require('./package.json').devDependencies['@jahia/cypress']")
echo Using @jahia/cypress@$version...
npx --yes --package @jahia/cypress@$version ci.build
