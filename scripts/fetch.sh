#!/bin/bash
# Fetch Romanian POI data from Overpass API in category batches
# to avoid timeout on the full query.

DATA_DIR="$(cd "$(dirname "$0")/../data" && pwd)"
echo "Output directory: $DATA_DIR"

fetch_category() {
  local name="$1"
  local query="$2"
  local outfile="$DATA_DIR/raw-${name}.json"

  echo ""
  echo "=== Fetching: $name ==="
  curl -s -X POST "https://overpass-api.de/api/interpreter" \
    --data-urlencode "data=${query}" \
    -o "$outfile" \
    -w "  Status: %{http_code} | Size: %{size_download} bytes | Time: %{time_total}s\n"

  # Check for errors
  if grep -q '"remark"' "$outfile" 2>/dev/null; then
    echo "  WARNING: Query may have timed out or errored!"
    grep '"remark"' "$outfile"
  fi
}

# 1. Tourism tags
fetch_category "tourism" '[out:json][timeout:90];area(id:3600090689)->.ro;nwr["tourism"~"museum|attraction|gallery|viewpoint|artwork|zoo|aquarium|theme_park"](area.ro);out center tags;'

# 2. Historic tags
fetch_category "historic" '[out:json][timeout:90];area(id:3600090689)->.ro;nwr["historic"~"castle|monument|memorial|ruins|archaeological_site|fort|citadel|church|monastery"](area.ro);out center tags;'

# 3. Nature
fetch_category "nature" '[out:json][timeout:90];area(id:3600090689)->.ro;(nwr["leisure"="nature_reserve"](area.ro);nwr["boundary"="national_park"](area.ro);nwr["natural"~"peak|cave_entrance|waterfall|glacier"](area.ro););out center tags;'

# 4. Places of worship (touristic)
fetch_category "worship" '[out:json][timeout:90];area(id:3600090689)->.ro;nwr["amenity"="place_of_worship"]["building"~"cathedral|church|monastery"](area.ro);out center tags;'

echo ""
echo "=== All fetches complete ==="
echo "Raw files in $DATA_DIR:"
ls -la "$DATA_DIR"/raw-*.json 2>/dev/null
