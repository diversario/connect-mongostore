REPORTER = spec

test:
	@mocha --reporter $(REPORTER)
	@$(MAKE) coverage

coverage:
	@rm -rf lib-cov reports
	@mkdir reports
	@istanbul instrument --output lib-cov lib
	@ISTANBUL_REPORTERS=lcov CONNECT_MONGOSTORE_COV=1 mocha -R mocha-istanbul -t 20s $(TESTS)
	@mv lcov.info reports
	@mv lcov-report reports
	@if [ $TRAVIS == "true" ]; then cat reports/lcov.info | ./node_modules/coveralls/bin/coveralls.js; fi
	@$(MAKE) clean

clean:
	@rm -rf lib-cov

.PHONY: test test-cov coverage
