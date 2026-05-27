#!/bin/bash
# Samba user-space environment setup
# Source this file: source /home/z/my-project/samba-install/bin/samba-env.sh

export SAMBA_HOME=/home/z/my-project/samba-install
export PATH=$SAMBA_HOME/usr/sbin:$SAMBA_HOME/usr/bin:$PATH
export LD_LIBRARY_PATH=$SAMBA_HOME/usr/lib/x86_64-linux-gnu:$SAMBA_HOME/usr/lib/x86_64-linux-gnu/samba:$LD_LIBRARY_PATH
export SMB_CONF_PATH=$SAMBA_HOME/etc/samba/smb.conf
