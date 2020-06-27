packages/pegjs/dist/bin.js: tools/bundler/rollup.bin.js packages/pegjs/lib/bin/*.ts
	npx rollup -c $<

bin: packages/pegjs/dist/bin.js
.PHONY: bin