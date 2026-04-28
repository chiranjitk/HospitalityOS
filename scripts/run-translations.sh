#!/bin/bash
# Run translations for fr, gu, ja, ml in sequence
# Each locale re-runs until progress is >95% or max attempts reached
set -e

LOCALES=("fr" "gu" "ja" "ml")
LOGDIR="/tmp/translate-logs"
mkdir -p "$LOGDIR"

for locale in "${LOCALES[@]}"; do
  echo "=========================================="
  echo "Starting translation for: $locale"
  echo "=========================================="
  
  attempt=1
  max_attempts=10
  
  while [ $attempt -le $max_attempts ]; do
    echo "--- Attempt $attempt for $locale ---"
    
    # Count remaining keys before
    BEFORE=$(node -e "
      const fs=require('fs');
      const en=JSON.parse(fs.readFileSync('src/messages/en.json','utf8'));
      const loc=JSON.parse(fs.readFileSync('src/messages/${locale}.json','utf8'));
      function f(o,p=''){const m={};for(const[k,v]of Object.entries(o)){const fk=p?p+'.'+k:k;if(typeof v==='object'&&v!==null)Object.assign(m,f(v,fk));else m[fk]=v;}return m;}
      const ef=f(en),lf=f(loc);
      let c=0;for(const[k,v]of Object.entries(ef)){if(lf[k]===v)c++;}console.log(c);
    ")
    
    echo "  Keys still in English: $BEFORE"
    
    if [ "$BEFORE" -lt 50 ]; then
      echo "  Done! Less than 50 keys remaining."
      break
    fi
    
    # Run translation
    npx tsx scripts/translate-locales.ts "$locale" > "${LOGDIR}/${locale}-attempt${attempt}.log" 2>&1
    EXIT_CODE=$?
    
    echo "  Exit code: $EXIT_CODE"
    tail -3 "${LOGDIR}/${locale}-attempt${attempt}.log"
    
    # If it crashed, wait before retry
    if [ $EXIT_CODE -ne 0 ]; then
      echo "  Script errored, waiting 30s before retry..."
      sleep 30
    fi
    
    # Wait between attempts to avoid rate limiting
    if [ $attempt -lt $max_attempts ]; then
      echo "  Waiting 60s to avoid rate limiting..."
      sleep 60
    fi
    
    attempt=$((attempt + 1))
  done
  
  # Final count
  AFTER=$(node -e "
    const fs=require('fs');
    const en=JSON.parse(fs.readFileSync('src/messages/en.json','utf8'));
    const loc=JSON.parse(fs.readFileSync('src/messages/${locale}.json','utf8'));
    function f(o,p=''){const m={};for(const[k,v]of Object.entries(o)){const fk=p?p+'.'+k:k;if(typeof v==='object'&&v!==null)Object.assign(m,f(v,fk));else m[fk]=v;}return m;}
    const ef=f(en),lf=f(loc);
    let c=0;for(const[k,v]of Object.entries(ef)){if(lf[k]===v)c++;}console.log(c);
  ")
  
  TOTAL=$(node -e "
    const fs=require('fs');
    const en=JSON.parse(fs.readFileSync('src/messages/en.json','utf8'));
    function f(o,p=''){const m={};for(const[k,v]of Object.entries(o)){const fk=p?p+'.'+k:k;if(typeof v==='object'&&v!==null)Object.assign(m,f(v,fk));else m[fk]=v;}return m;}
    console.log(Object.keys(f(en)).length);
  ")
  
  TRANSLATED=$((TOTAL - AFTER))
  PCT=$(node -e "console.log((${TRANSLATED}/${TOTAL}*100).toFixed(1))")
  echo "=== $locale FINAL: $TRANSLATED/$TOTAL keys translated ($PCT%) ==="
  
  # Wait between locales
  echo "  Waiting 30s before next locale..."
  sleep 30
done

echo ""
echo "=========================================="
echo "ALL TRANSLATIONS COMPLETE"
echo "=========================================="

# Summary
for locale in "${LOCALES[@]}"; do
  node -e "
    const fs=require('fs');
    const en=JSON.parse(fs.readFileSync('src/messages/en.json','utf8'));
    const loc=JSON.parse(fs.readFileSync('src/messages/${locale}.json','utf8'));
    function f(o,p=''){const m={};for(const[k,v]of Object.entries(o)){const fk=p?p+'.'+k:k;if(typeof v==='object'&&v!==null)Object.assign(m,f(v,fk));else m[fk]=v;}return m;}
    const ef=f(en),lf=f(loc);
    let same=0,diff=0;
    for(const[k,v]of Object.entries(ef)){if(lf[k]===v)same++;else diff++;}
    console.log('${locale}: ' + diff + '/' + (same+diff) + ' translated (' + (diff/(same+diff)*100).toFixed(1) + '%)');
  "
done
