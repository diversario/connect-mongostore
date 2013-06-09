REPORTER = spec

test:
	@mocha --reporter $(REPORTER)

coverage:
	@$(MAKE) clean
	@mkdir reports
	@istanbul instrument --output lib-cov lib
	@ISTANBUL_REPORTERS=lcov CONNECT_MONGOSTORE_COV=1 mocha -R mocha-istanbul -t 20s $(TESTS)
	@mv lcov.info reports
	@mv lcov-report reports
	@rm -rf lib-cov

coveralls: test coverage
	@cat reports/lcov.info | ./node_modules/coveralls/bin/coveralls.js
	@$(MAKE) clean

clean:
	@rm -rf lib-cov reports

.PHONY: test test-cov coverage
