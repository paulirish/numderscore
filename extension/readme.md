
## Adding new fonts

- I like using https://wakamaifondue.com/beta/ to generate CSS (drop in the font and scroll to the bottom).
- Don't forget the `fonts/` path prefix in the manifest `web_accessible_resources`, and `numder_style.css`
  - If the font filename has a space in it, you need to use `%20` instead of spaces within the manifests's `web_accessible_resources` array. (Weird, yes.)
- You might want to add a `font-weight` property to the @font-face rule.
