#!/bin/bash
cd /home/z/my-project
export DATABASE_URL="postgresql://staysuite:Staysuite2025@127.0.0.1:5432/staysuite?connection_limit=10&pool_timeout=30"
exec npx next dev -p 3000
