# Numderscore
Based substantially on [Numderline](https://github.com/trishume/numderline) but
becoming kind of its own thing as I hack around.

Allows the rendering of digit grouping (thousand separators) in contexts where
you have some control over the font but don't want to (or can't) edit the text
inline.  It looks a bit like this:

![sample](./sample.png)

This is achieved by adding font features to font files which enable outboard
configuration of number formatting.

Feature names for the  features are:

| Feature Name | Example | *D*igit *G*rouping with… |
| :--- | ---: | :--- |
| `dgsp` | `125 603.1415965` | **spaces** within whole numbers |
| `dgco` | `125,603.1415965` | **commas** within whole numbers |
| `dgun` | `125_603.141_596_5` | **underscores** within whole numbers and decimals |
| `dgdo` | `125.603,1415965` | **dots** within whole numbers (and replacing literal dot with comma, use with caution) |
| `dgdd` | `125.603,141.596.5` | **dots** within whole numbers and decimals (and replacing literal dot with comma, use with caution) |

## Usage: Patch the font
Patch a font to add the extra stuff:

```sh
python3 patcher.py SomeFont.ttf

python3 patcher.py --help # see available options 
```

## Usage: Apply the features

If you have [CSS control with `font-feature-settings`](https://developer.mozilla.org/en-US/docs/Web/CSS/font-feature-settings) over the font, try:

```CSS
font-feature-settings: "dgsp";
```
for the bits you want formatted that way (try to avoid switching it on
globally, as it may mess other things up).


Various editors/tools using these font-features. See https://github.com/tonsky/FiraCode/wiki/How-to-enable-stylistic-sets (just change `ss01` to `dgsp`, etc.)

To use it in a terminal (if you have one which supports ligation), you can use
a monospaced font and pass `--monospace` to the patcher so that it will
squeeze glyphs appropriately.

Usage might be configured with a line like: `font=My Font with DigitGrouping:fontfeatures=dgsp`
or `font_features My-Font-with-DigitGrouping dgsp`, or, in fontconfig:

```xml
    <match target="pattern">
         <test name="family" compare="contains"><string>DigitGrouping</string></test>
         <edit name="fontfeatures" mode="append">
             <string>dgsp</string>
         </edit>
     </match>
```

Or if all of that is too much hassle or isn't working out right, just bake
in `dgsp` as the default, by passing `--feature-name=calt` to the patcher.
