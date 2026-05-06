#!/bin/bash
# Environment setup for ulogd dependencies
export PREFIX=/home/z/ulogd-build/install
export PKG_CONFIG_PATH="$PREFIX/lib/pkgconfig:/usr/lib/x86_64-linux-gnu/pkgconfig"
export LD_LIBRARY_PATH="$PREFIX/lib:/usr/local/lib"
export PATH="$PREFIX/bin:$PATH"
export CFLAGS="-I$PREFIX/include"
export LDFLAGS="-L$PREFIX/lib"
