scour:
	for i in icons/*.svg; do \
	  scour --remove-descriptive-elements --no-renderer-workaround --enable-id-stripping \
	        --create-groups --strip-xml-prolog --enable-comment-stripping --shorten-ids \
	        --nindent=2 "$$i" "$$i.scour" && \
	  mv -f "$$i.scour" "$$i"; \
	done

zip:
	git archive --format zip -o sort-bookmarks-$(shell git describe --tags HEAD).zip HEAD
