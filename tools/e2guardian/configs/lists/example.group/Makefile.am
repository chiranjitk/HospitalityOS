DISTCLEANFILES = Makefile.in

E2DATADIR = $(E2CONFDIR)/lists/example.group

SUBDIRS = .

WLISTS = bannedphraselist \
oldbannedphraselist \
bannedurllist \
bannedsitelist \
domainsnobypass \
urlnobypass \
exceptionphraselist \
weightedphraselist \
oldexceptionphraselist \
oldweightedphraselist

EXTRA_DIST =

install-data-local:
	$(mkinstalldirs) $(DESTDIR)$(E2DATADIR) && \
		for l in $(WLISTS) ; do \
		echo "$(INSTALL_DATA) $$l $(DESTDIR)$(E2DATADIR)/$$l"; \
		$(INSTALL_DATA) $$l $(DESTDIR)$(E2DATADIR)/$$l; \
	done


uninstall-local:
	for l in $(WLISTS) ; do \
		rm -f $(DESTDIR)$(E2DATADIR)/$$l ; \
	done
