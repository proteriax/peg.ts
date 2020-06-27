packages/pegjs/dist/bin.js: tools/bundler/rollup.bin.js packages/pegjs/lib/bin/*.ts
	npx rollup -c $<

bin: packages/pegjs/dist/bin.js
npm:
	cd packages;\
	cp pegjs/package.json npm/;\
	cp -r pegjs/dist npm/;\
	cp -r pegjs/README.md npm/;\
	gsed -i 's:lib/mod.ts:dist/peg.cjs.js:' npm/package.json

.PHONY: bin npm