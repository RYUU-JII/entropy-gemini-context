PROFILE ?= en

.PHONY: dev attach down status

dev:
	cx up $(PROFILE)

attach:
	cx attach $(PROFILE)

down:
	cx down $(PROFILE)

status:
	cx status $(PROFILE)
