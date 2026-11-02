// Writes the Maven version into the package.json of the module the release build is in (the working
// directory), so the packages the release ships say the version they are: Maven's release bumps the
// poms only, and the views package would otherwise install as 1.0.0-SNAPSHOT. Run by the
// release-prepare profile of the root pom (after Formidable's .m2/sync-version.js). A module without a
// package.json (the root aggregator) is skipped.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const mavenVersion = process.argv[2];
if (!mavenVersion) {
    console.error('Usage: node sync-version.js <maven-version>');
    process.exit(1);
}
const pkgPath = resolve(process.cwd(), 'package.json');
if (!existsSync(pkgPath)) {
    console.log(`No package.json in ${process.cwd()}`);
    process.exit(0);
}
const text = readFileSync(pkgPath, 'utf8');
const pkg = JSON.parse(text);
// A valid semver, the snapshot being said by jahia.snapshot
pkg.version = mavenVersion.replace(/-SNAPSHOT$/, '');
if (pkg.jahia && 'snapshot' in pkg.jahia) {
    pkg.jahia.snapshot = /-SNAPSHOT$/.test(mavenVersion);
}
// Keep the file's own indentation
const indent = /^\{\n(\s+)"/.exec(text)?.[1] ?? '  ';
writeFileSync(pkgPath, JSON.stringify(pkg, null, indent) + '\n');
console.log(`package.json version set to ${pkg.version} in ${process.cwd()}`);
