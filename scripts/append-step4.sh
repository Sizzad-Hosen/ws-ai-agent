#!/usr/bin/env bash
# Appends the objects Prisma cannot express to the init migration.
# Idempotent: it refuses to append twice.
set -euo pipefail
f=$(ls prisma/migrations/*_init/migration.sql)
if grep -q "uq_one_live_subscription" "$f"; then echo "already appended: $f"; exit 0; fi
cat prisma/sql/step4.sql >> "$f"
python -c "
import io,sys
p=sys.argv[1]; s=io.open(p,encoding='utf-8').read()
io.open(p,'w',encoding='utf-8',newline='\n').write('-- Required by every uuid primary key default below.\nCREATE EXTENSION IF NOT EXISTS pgcrypto;\n\n'+s)
" "$f"
echo "appended step 4 objects to $f"
