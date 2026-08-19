#!/bin/bash
# Nightly backup of the House of Card and Coin's guild data and uploads.
# Lives on the VPS at /var/www/hocc-backup.sh, run by cron at 03:17.
# This copy in the repo is the source of truth; edit here and copy up.
#
# What changed from the first version, and why:
#
#   It kept seven nights. A mistake noticed eight days later had no good copy
#   left to go back to, and the ones it did keep were never checked — the script
#   wrote an archive and immediately deleted older ones, so a tar that failed
#   halfway would take the good copies with it and leave the bad one standing.
#
#   Now: the new archive is read back before anything old is touched, and if it
#   cannot be read nothing is deleted and the run is marked failed. Retention is
#   thinned rather than truncated — a month of nights, then one a week for three
#   months, then one a month for two years, which is about forty megabytes on a
#   disk with seventy-six gigabytes free. And a second copy is kept outside
#   /var/www, so clearing the web root by accident does not take the backups
#   with it.
#
#   It also writes a small status file the site reads, so the Guild Leader can
#   see in Administration that last night's backup happened and was sound. A
#   backup nobody checks is a backup nobody knows is broken.

set -uo pipefail

SRC=/var/www/hocc
DEST=/var/www/hocc-backups
MIRROR=/var/backups/hocc
STATUS="$DEST/status.json"
STAMP=$(date +%Y%m%d-%H%M%S)
FILE="hocc-$STAMP.tgz"

mkdir -p "$DEST" "$MIRROR"

say(){ echo "$(date '+%Y-%m-%d %H:%M:%S') $*"; }

# The status file is what Administration shows. Written on every outcome,
# including the bad ones — a status that only appears when things go well is
# indistinguishable from a script that stopped running.
write_status(){
  local ok="$1" msg="$2" kept
  kept=$(ls -1 "$DEST"/hocc-*.tgz 2>/dev/null | wc -l)
  cat > "$STATUS" <<JSON
{"ok":$ok,"at":$(date +%s)000,"file":"$FILE","kept":$kept,"note":"$msg"}
JSON
}

# ── make it ─────────────────────────────────────────────────────────────────
if ! tar -czf "$DEST/$FILE" -C "$SRC" app/data app/uploads 2>/dev/null; then
  say "FAILED: could not write $FILE — nothing deleted"
  rm -f "$DEST/$FILE"
  write_status false "could not write the archive"
  exit 1
fi

# ── read it back before trusting it ─────────────────────────────────────────
# The listing goes to a file rather than down a pipe. `tar | grep -q` looks
# right and is a trap: grep leaves the moment it finds the line, tar takes a
# broken pipe, and with pipefail set the whole check reports failure on a
# perfectly good archive. That is exactly what this script did on its first
# run — refused its own backup and said guild.json was missing.
LIST=$(mktemp)
trap 'rm -f "$LIST"' EXIT

if ! tar -tzf "$DEST/$FILE" > "$LIST" 2>/dev/null; then
  say "FAILED: $FILE will not read back — nothing deleted"
  rm -f "$DEST/$FILE"
  write_status false "the archive would not read back"
  exit 1
fi
# and that the one thing that matters is actually inside it
if ! grep -q 'app/data/guild.json' "$LIST"; then
  say "FAILED: $FILE has no guild.json in it — nothing deleted"
  rm -f "$DEST/$FILE"
  write_status false "guild.json was missing from the archive"
  exit 1
fi

SIZE=$(du -h "$DEST/$FILE" | cut -f1)

# ── a second copy, off the web root ─────────────────────────────────────────
cp -f "$DEST/$FILE" "$MIRROR/$FILE" 2>/dev/null || say "note: could not mirror to $MIRROR"

# ── thin the old ones ───────────────────────────────────────────────────────
# Every night for a month, then Sundays for three months, then the first of the
# month for two years. Anything matching none of those goes.
thin(){
  local dir="$1" f base day keep
  local today_s; today_s=$(date +%s)
  for f in "$dir"/hocc-*.tgz; do
    [ -e "$f" ] || continue
    base=$(basename "$f")
    day=${base:5:8}                                  # hocc-YYYYMMDD-...
    [ ${#day} -eq 8 ] || continue
    local when_s age_days dow dom
    when_s=$(date -d "${day:0:4}-${day:4:2}-${day:6:2}" +%s 2>/dev/null) || continue
    age_days=$(( (today_s - when_s) / 86400 ))
    dow=$(date -d "${day:0:4}-${day:4:2}-${day:6:2}" +%u 2>/dev/null)
    dom=${day:6:2}
    keep=no
    [ "$age_days" -le 30 ] && keep=yes                       # a month of nights
    [ "$age_days" -le 120 ] && [ "$dow" = "7" ] && keep=yes   # then Sundays
    [ "$age_days" -le 730 ] && [ "$dom" = "01" ] && keep=yes  # then month firsts
    if [ "$keep" = "no" ]; then rm -f "$f"; fi
  done
}
thin "$DEST"
thin "$MIRROR"

KEPT=$(ls -1 "$DEST"/hocc-*.tgz 2>/dev/null | wc -l)
say "backup $FILE created ($SIZE), read back clean, $KEPT kept"
write_status true "read back clean"
