previous_tag=$(git describe --tags --abbrev=0 --match 'v*' || true)
dependencies_only=()
: > changes.md

# Candidates: packages whose CHANGELOG.md or package.json changed since the previous tag
candidates=$(git log --name-only --format= ${previous_tag:+"$previous_tag..HEAD"} -- '*CHANGELOG.md' '*package.json' | xargs -r -n1 dirname | sort -u)

for dir in $candidates; do
  manifest="$dir/package.json"
  [ -f "$manifest" ] && [ -f "$dir/CHANGELOG.md" ] || continue

  read -r name version private <<< "$(node -p "const p = require('./$manifest'); [p.name, p.version, Boolean(p.private)].join(' ')")"
  [ "$private" = true ] && continue

  previous=$(git show "$previous_tag:$manifest" 2> /dev/null | node -p "JSON.parse(require('fs').readFileSync(0)).version" 2> /dev/null || true)
  [ "$version" = "$previous" ] && continue

  section=$(awk -v v="$version" '$0 == "## " v {f=1; next} /^## /{f=0} f' "$dir/CHANGELOG.md")

  # No entry other than "Updated dependencies": just list the package at the end
  if ! grep -E '^- ' <<< "$section" | grep -vq '^- Updated dependencies'; then
    dependencies_only+=("\`$name@$version\`")
    continue
  fi

  printf '## %s %s\n%s\n\n' "$name" "$version" "$section" >> changes.md
done

if [ ${#dependencies_only[@]} -gt 0 ]; then
  echo "**Dependency updates only:** ${dependencies_only[*]}" >> changes.md
fi

# Changelog entries span several lines: join each one, keep the "security:" ones once
security=$(awk '
  function flush() { if (entry != "" && tolower(entry) ~ /(^- |! - )security:/ && !seen[entry]++) print entry; entry = "" }
  /^- / { flush(); entry = $0; next }
  /^  [^ -]/ && entry != "" { sub(/^ +/, ""); entry = entry " " $0; next }
  { flush() }
  END { flush() }
' changes.md)

{
  echo '## Security'
  echo
  echo "${security:-No security fixes in this release.}"
  echo
  cat changes.md
} > notes.md

