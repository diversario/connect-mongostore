REPORTER = spec

test:
	@mocha --reporter $(REPORTER)

test-cov:
	@$(MAKE) clean
	@$(MAKE) lib-cov
	@CONNECT_MONGOSTORE_COV=1 $(MAKE) test REPORTER=html-cov > coverage.html
	@$(MAKE) clean

lib-cov:
	@jscoverage lib lib-cov

clean:
	@rm -rf lib-cov

.PHONY: test test-cov
